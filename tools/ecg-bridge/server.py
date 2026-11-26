#!/usr/bin/env python3
"""
Bridge MD100C_P (BLE Card ECG) → MaindHealth estación
http://127.0.0.1:3928

Solo captura la onda (trazado) para el kiosko.
La frecuencia cardiaca (lpm) NO se toma de este aparato:
viene del oxímetro CMS50D+ en el paso de SpO₂.

Decodificación de onda (ecg.py de estación):
  si len(data) >= 4 y 30 <= data[3] <= 200 → un punto del trazado.
"""

from __future__ import annotations

import asyncio
import json
import math
import os
import threading
import time
from collections import deque
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
# Ventana de trazado (~últimos puntos, como el historial de 30 en ecg.py).
WAVE_BUFFER_MAX = int(os.environ.get("ECG_WAVE_BUFFER_MAX", "120"))
WAVE_PROGRESS_POINTS = int(os.environ.get("ECG_WAVE_PROGRESS_POINTS", "90"))

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


def extract_wave_point(data: bytes) -> int | None:
    """
    Traducción de onda según ecg.py de estación:
    data[3] = amplitud del trazado (un punto por notificación BLE).
    """
    if len(data) < 4:
        return None
    value = int(data[3])
    if 30 <= value <= 200:
        return value
    return None


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
    point = extract_wave_point(raw)
    note = f"wave={point} " if point is not None else ""
    _log_hex(raw, note)

    if point is None:
        return

    with _lock:
        _wave_samples.append(point)
        _wave_total += 1
        n = _wave_total

    if n == 1 or n % 8 == 0:
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
                # Onda sintética; sin heartRate (eso es del oxímetro).
                synthetic = [70 + int(25 * math.sin(i / 3.2)) for i in range(60)]
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
