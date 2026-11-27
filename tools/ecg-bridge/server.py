#!/usr/bin/env python3
"""
Bridge MD100C_P (BLE Card ECG) → MaindHealth estación
http://127.0.0.1:3928

Solo captura la onda (trazado) para el kiosko.
La frecuencia cardiaca (lpm) NO se toma de este aparato:
viene del oxímetro CMS50D+ en el paso de SpO₂.

Decodificación de onda ChoiceMMed (trama 16 B):
  0x01 + 5×[LO, HI, FLAG] → amplitud = LO | (HI<<8).
  En MD100C_P suele intercalarse un byte/constante ~34 (no es amplitud);
  si no se filtra, el trazo sale triangular / “diente de sierra”.
  Fallback ecg.py: data[3] si 30..200.
"""

from __future__ import annotations

import asyncio
import json
import math
import os
import threading
import time
from collections import Counter, deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from bleak import BleakClient

HOST = "127.0.0.1"
PORT = int(os.environ.get("ECG_BRIDGE_PORT", "3928"))
TARGET_ADDRESS = os.environ.get("ECG_MD100C_ADDRESS", "FB:1E:E4:A4:03:00").strip()
READ_TIMEOUT_MS = int(os.environ.get("ECG_READ_TIMEOUT_MS", "150000"))
MIN_MEASURE_SEC = float(os.environ.get("ECG_MIN_MEASURE_SEC", "28"))
# Mínimo de puntos de onda antes de poder auto-cerrar (tras MIN_MEASURE_SEC).
MIN_WAVE_POINTS = int(os.environ.get("ECG_MIN_WAVE_POINTS", "40"))
HEX_LOG_LIMIT = int(os.environ.get("ECG_HEX_LOG_LIMIT", "80"))
# ~3–4 s de onda a ~120 Hz (5 muestras/paquete).
WAVE_BUFFER_MAX = int(os.environ.get("ECG_WAVE_BUFFER_MAX", "480"))
WAVE_PROGRESS_POINTS = int(os.environ.get("ECG_WAVE_PROGRESS_POINTS", "360"))

# Comandos de activación (mismos que ecg.py / script de estación).
ACTIVATE_COMMANDS = [
    bytes([0x01, 0x00]),
    bytes([0x55, 0xAA, 0x20, 0x00, 0x00, 0x00, 0x20]),
]

_lock = threading.Lock()
_progress: dict[str, Any] = {"phase": "idle", "message": "Listo", "device": "md100c_p"}
_patient_done = False
_reading = False
_loop: asyncio.AbstractEventLoop | None = None
_wave_samples: deque[int] = deque(maxlen=WAVE_BUFFER_MAX)
_wave_total = 0
_hex_logged = 0


def set_progress(phase: str, message: str) -> None:
    with _lock:
        _progress["phase"] = phase
        _progress["message"] = message
        _progress["device"] = "md100c_p"
        _progress["wavePoints"] = _wave_total


def get_progress() -> dict[str, Any]:
    with _lock:
        out = dict(_progress)
        if _wave_samples:
            wave = list(_wave_samples)
            if len(wave) > WAVE_PROGRESS_POINTS:
                wave = wave[-WAVE_PROGRESS_POINTS:]
            out["wave"] = wave
        else:
            out["wave"] = []
        return out


def _strip_protocol_constant(pts: list[int]) -> list[int]:
    """
    Quita el canal constante (~34) intercalado en MD100C_P.
    Ejemplo crudo: 34,146,34,147,34,152 → 146,147,152.
    """
    if len(pts) < 4:
        return pts

    even = pts[0::2]
    odd = pts[1::2]

    def mostly_constant(xs: list[int]) -> tuple[bool, int]:
        if not xs:
            return False, 0
        val, n = Counter(xs).most_common(1)[0]
        return n >= max(2, int(len(xs) * 0.65)), val

    even_c, even_v = mostly_constant(even)
    odd_c, odd_v = mostly_constant(odd)
    # Un índice es casi fijo (~34) y el otro varía → quedarnos con el variable.
    if even_c and not odd_c and 20 <= even_v <= 45:
        return odd
    if odd_c and not even_c and 20 <= odd_v <= 45:
        return even

    val, n = Counter(pts).most_common(1)[0]
    if n >= max(3, int(len(pts) * 0.35)) and 20 <= val <= 45:
        cleaned = [p for p in pts if p != val]
        if len(cleaned) >= 2:
            return cleaned
    return pts


def extract_wave_points(data: bytes) -> list[int]:
    """
    Onda ChoiceMMed BLE (MD100C_P):

    Trama 16 bytes: 0x01 + cinco muestras [LO, HI, FLAG].
    Amplitud = LO | (HI << 8). FLAG se ignora.
    Luego se elimina el constante ~34 intercalado (si aparece).

    Fallback (ecg.py): un punto en data[3] si 30..200 (y != 34 puro de relleno).
    """
    if not data:
        return []

    if data[0] == 0x01 and len(data) >= 16:
        pts: list[int] = []
        # 5 triplets caben en 16 bytes (offsets 1,4,7,10,13).
        for i in range(1, 16, 3):
            if i + 1 >= len(data):
                break
            lo = int(data[i])
            hi = int(data[i + 1])
            pts.append(lo | (hi << 8))
        pts = _strip_protocol_constant(pts)
        if len(pts) >= 2:
            return pts

    # Fallback exacto de ecg.py (omite la constante típica 34).
    if len(data) >= 4:
        value = int(data[3])
        if 30 <= value <= 200 and value != 34:
            return [value]
    return []


def _log_hex(data: bytes, note: str = "") -> None:
    global _hex_logged
    if _hex_logged >= HEX_LOG_LIMIT:
        return
    _hex_logged += 1
    hx = data.hex(" ")
    print(f"[ecg-bridge] BLE#{_hex_logged} len={len(data)} {note}[{hx}]", flush=True)


def notification_handler(_sender: Any, data: bytearray) -> None:
    global _wave_total
    raw = bytes(data)
    points = extract_wave_points(raw)
    note = f"wave+{len(points)} " if points else ""
    _log_hex(raw, note)

    if not points:
        return

    with _lock:
        _wave_samples.extend(points)
        _wave_total += len(points)
        n = _wave_total

    if n <= 16 or n % 24 == 0:
        set_progress(
            "measure",
            f"Onda en vivo… {n} puntos. Dedos en las placas; luego Ya terminó.",
        )


async def _write_activate(client: BleakClient) -> None:
    for service in client.services:
        for char in service.characteristics:
            props = char.properties or []
            if "write" not in props and "write-without-response" not in props:
                continue
            for cmd in ACTIVATE_COMMANDS:
                try:
                    await client.write_gatt_char(char.uuid, cmd, response=False)
                    print(
                        f"[ecg-bridge] write {char.uuid} <- {cmd.hex(' ')}",
                        flush=True,
                    )
                except Exception as err:
                    print(f"[ecg-bridge] write fail {char.uuid}: {err}", flush=True)


async def _subscribe_all(client: BleakClient) -> None:
    for service in client.services:
        print(f"[ecg-bridge] service {service.uuid}", flush=True)
        for char in service.characteristics:
            props = list(char.properties or [])
            print(f"[ecg-bridge]  char {char.uuid} props={props}", flush=True)
            if "notify" not in props and "indicate" not in props:
                continue
            try:
                await client.start_notify(char.uuid, notification_handler)
                print(f"[ecg-bridge]  notify ON {char.uuid}", flush=True)
            except Exception as err:
                print(f"[ecg-bridge]  notify fail {char.uuid}: {err}", flush=True)


async def measure_once() -> dict[str, Any]:
    global _patient_done, _wave_total, _hex_logged

    with _lock:
        _wave_samples.clear()
        _wave_total = 0
        _patient_done = False
        _hex_logged = 0

    set_progress("connect", f"Conectando al MD100C_P ({TARGET_ADDRESS})…")
    deadline = time.monotonic() + (READ_TIMEOUT_MS / 1000.0)

    try:
        async with BleakClient(TARGET_ADDRESS, timeout=25.0) as client:
            if not client.is_connected:
                raise RuntimeError("No se pudo conectar al MD100C_P por Bluetooth.")

            set_progress(
                "measure",
                "Conectado. Dedos en las placas del MD100C_P ~30 s. Luego toque Ya terminó.",
            )
            await _subscribe_all(client)
            await asyncio.sleep(0.8)
            await _write_activate(client)

            started = time.monotonic()
            last_tick = -1
            while time.monotonic() < deadline:
                done = False
                with _lock:
                    done = _patient_done
                    n = _wave_total
                elapsed = time.monotonic() - started
                tick = int(elapsed)

                if done:
                    with _lock:
                        _patient_done = False
                    break

                # Auto-cierra con trazado suficiente (sin FC: eso es del oxímetro).
                if elapsed >= MIN_MEASURE_SEC and n >= MIN_WAVE_POINTS:
                    set_progress("measure", f"Trazado listo ({n} puntos). Cerrando…")
                    break

                if tick != last_tick and tick % 5 == 0:
                    last_tick = tick
                    set_progress(
                        "measure",
                        f"Midiendo MD100C_P… {tick} s · {n} puntos de onda. Dedos en placas; luego Ya terminó.",
                    )
                await asyncio.sleep(0.25)
            else:
                raise RuntimeError(
                    "El MD100C_P tardó demasiado. Enciéndalo, dedos en las placas y toque Ya terminó."
                )

            with _lock:
                wave = list(_wave_samples)
                total = _wave_total

            if total < 8:
                raise RuntimeError(
                    "No llegó la onda del MD100C_P. "
                    "Mantenga los dedos firmes en las placas ~30 s y toque Ya terminó."
                )

            rhythm = "Trazado ECG registrado (MD100C_P)"
            set_progress("idle", f"{rhythm} · {total} puntos")
            return {
                "ok": True,
                "rhythm": rhythm,
                "wavePoints": total,
                "wave": wave[-WAVE_PROGRESS_POINTS:],
                "source": "md100c_p",
                "address": TARGET_ADDRESS,
            }
    except Exception as err:
        msg = str(err) or err.__class__.__name__
        if "not found" in msg.lower() or "could not" in msg.lower() or "failed to connect" in msg.lower():
            msg = (
                f"No se encontró el MD100C_P ({TARGET_ADDRESS}). "
                "Enciéndalo cerca de la PC, con Bluetooth activo, e intente de nuevo."
            )
        set_progress("idle", msg)
        raise RuntimeError(msg) from err


def run_measure_sync() -> dict[str, Any]:
    if _loop is None:
        raise RuntimeError("El bucle BLE no está listo.")
    fut = asyncio.run_coroutine_threadsafe(measure_once(), _loop)
    return fut.result(timeout=(READ_TIMEOUT_MS / 1000.0) + 30)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[ecg-bridge] {self.address_string()} - {fmt % args}")

    def _send(self, status: int, body: dict[str, Any]) -> None:
        raw = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(raw)

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except Exception:
            return {}

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._send(204, {})

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/health":
            self._send(
                200,
                {
                    "ok": True,
                    "device": "md100c_p",
                    "address": TARGET_ADDRESS,
                    **get_progress(),
                },
            )
            return
        if path == "/progress":
            self._send(200, {"ok": True, **get_progress()})
            return
        self._send(404, {"ok": False, "error": "Not found"})

    def do_POST(self) -> None:  # noqa: N802
        global _patient_done, _reading

        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        body = self._read_json()

        if path == "/continue":
            with _lock:
                _patient_done = True
            set_progress("measure", "Cerrando medición…")
            self._send(200, {"ok": True})
            return

        if path == "/read":
            simulate = qs.get("simulate", ["0"])[0] == "1" or body.get("simulate") is True
            if simulate:
                # Onda sintética tipo ECG (uint16); sin heartRate (oxímetro).
                synthetic = []
                for i in range(200):
                    t = (i % 40) / 40.0
                    y = 512.0
                    if 0.28 <= t < 0.38:
                        u = (t - 0.28) / 0.1
                        y += -40 + (900 * u if u < 0.4 else 360 - (u - 0.4) * 700)
                    elif 0.55 < t < 0.75:
                        y += 60 * math.sin(((t - 0.55) / 0.2) * math.pi)
                    synthetic.append(int(y + 3 * math.sin(i / 9)))
                self._send(
                    200,
                    {
                        "ok": True,
                        "rhythm": "Trazado ECG registrado (MD100C_P)",
                        "wavePoints": len(synthetic),
                        "wave": synthetic,
                        "source": "md100c_p",
                        "simulated": True,
                    },
                )
                return

            with _lock:
                if _reading:
                    self._send(409, {"ok": False, "error": "Ya hay una lectura de ECG en curso."})
                    return
                _reading = True

            try:
                result = run_measure_sync()
                self._send(200, result)
            except Exception as err:
                self._send(503, {"ok": False, "error": str(err)})
            finally:
                with _lock:
                    _reading = False
            return

        self._send(404, {"ok": False, "error": "Not found"})


def start_asyncio_loop() -> None:
    global _loop
    _loop = asyncio.new_event_loop()
    asyncio.set_event_loop(_loop)
    _loop.run_forever()


def main() -> None:
    t = threading.Thread(target=start_asyncio_loop, name="ble-loop", daemon=True)
    t.start()
    for _ in range(50):
        if _loop is not None:
            break
        time.sleep(0.05)

    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(
        f"[ecg-bridge] MD100C_P onda BLE http://{HOST}:{PORT} address={TARGET_ADDRESS} (FC = oxímetro)",
        flush=True,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if _loop is not None:
            _loop.call_soon_threadsafe(_loop.stop)


if __name__ == "__main__":
    main()
