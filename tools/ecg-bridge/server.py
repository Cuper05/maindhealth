#!/usr/bin/env python3
"""
Bridge MD100C_P (BLE Card ECG) → MaindHealth estación
http://127.0.0.1:3928

IMPORTANTE: el MD100C_P es una placa ECG (ChoiceMMed). Mezcla tramas de
onda (muy frecuentes) con tramas de resultado/FC. NO se debe tomar data[3]
de cualquier notificación: eso daba siempre ~34 lpm (byte de la onda).
"""

from __future__ import annotations

import asyncio
import json
import os
import statistics
import threading
import time
from collections import Counter, defaultdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from bleak import BleakClient

HOST = "127.0.0.1"
PORT = int(os.environ.get("ECG_BRIDGE_PORT", "3928"))
TARGET_ADDRESS = os.environ.get("ECG_MD100C_ADDRESS", "FB:1E:E4:A4:03:00").strip()
READ_TIMEOUT_MS = int(os.environ.get("ECG_READ_TIMEOUT_MS", "150000"))
# Tramas de FC reales llegan ~1 Hz; con 3 ya basta para mediana.
MIN_SAMPLES = int(os.environ.get("ECG_MIN_SAMPLES", "3"))
MIN_MEASURE_SEC = float(os.environ.get("ECG_MIN_MEASURE_SEC", "28"))
HEX_LOG_LIMIT = int(os.environ.get("ECG_HEX_LOG_LIMIT", "80"))

# Comandos de activación del script de estación.
ACTIVATE_COMMANDS = [
    bytes([0x01, 0x00]),
    bytes([0x55, 0xAA, 0x20, 0x00, 0x00, 0x00, 0x20]),
]

_lock = threading.Lock()
_progress: dict[str, Any] = {"phase": "idle", "message": "Listo", "device": "md100c_p"}
_patient_done = False
_reading = False
_loop: asyncio.AbstractEventLoop | None = None
_pulse_samples: list[int] = []
_raw_packets: list[bytes] = []
_hex_logged = 0


def set_progress(phase: str, message: str) -> None:
    with _lock:
        _progress["phase"] = phase
        _progress["message"] = message
        _progress["device"] = "md100c_p"
        _progress["samples"] = len(_pulse_samples)


def get_progress() -> dict[str, Any]:
    with _lock:
        return dict(_progress)


def rhythm_from_hr(hr: int) -> str:
    if hr < 50:
        return "Bradicardia (FC baja · MD100C_P)"
    if hr < 60:
        return "FC ligeramente baja (MD100C_P)"
    if hr <= 100:
        return "FC en rango normal (MD100C_P)"
    if hr <= 120:
        return "Taquicardia leve (MD100C_P)"
    return "Taquicardia (MD100C_P)"


def quality_from_samples(samples: list[int]) -> str:
    if len(samples) < MIN_SAMPLES:
        return "poor"
    if len(samples) < 2:
        return "fair"
    spread = max(samples) - min(samples)
    if spread <= 8:
        return "good"
    if spread <= 18:
        return "fair"
    return "poor"


def summarize(samples: list[int]) -> tuple[int, str, str]:
    if len(samples) < 1:
        raise RuntimeError(
            "No llegó la frecuencia cardiaca del MD100C_P. "
            "Mantenga los dedos en las placas ~30 s hasta ver la FC en el aparato y toque Ya terminó."
        )
    hr = int(round(statistics.median(samples)))
    if not (30 <= hr <= 240):
        raise RuntimeError("Frecuencia cardiaca fuera de rango. Reintente con los dedos firmes en las placas.")
    return hr, rhythm_from_hr(hr), quality_from_samples(samples)


def _log_hex(data: bytes, note: str = "") -> None:
    global _hex_logged
    if _hex_logged >= HEX_LOG_LIMIT:
        return
    _hex_logged += 1
    hx = data.hex(" ")
    print(f"[ecg-bridge] BLE#{_hex_logged} len={len(data)} {note}[{hx}]", flush=True)


def extract_hr_from_packet(data: bytes) -> int | None:
    """
    Extrae FC solo de tramas de resultado / vitals.
    Ignora onda PPG/ECG cruda (antes data[3] ≈ 34 fijo).
    """
    if not data:
        return None

    # Onda ChoiceMMed / PPG: 16 bytes empezando en 0x01 — NO es FC.
    if data[0] == 0x01 and len(data) in (16, 17, 20):
        return None

    # Vitals estilo MD300 / PLX vendor: 3E SS 00 HH 00 ...
    if len(data) >= 5 and data[0] == 0x3E:
        hr = int(data[3])
        if 30 <= hr <= 240:
            return hr

    # Heart Rate Measurement (Bluetooth SIG 0x2A37)
    if 2 <= len(data) <= 10:
        flags = int(data[0])
        # flags típicos; evita confundir con basura de onda
        if flags <= 0x1F:
            if flags & 0x01:
                if len(data) >= 3:
                    hr = int(data[1]) | (int(data[2]) << 8)
                    if 30 <= hr <= 240:
                        return hr
            else:
                hr = int(data[1])
                if 30 <= hr <= 240:
                    return hr

    # Trama ChoiceMMed 55 AA [len] [cmd] [payload…]
    if len(data) >= 7 and data[0] == 0x55 and data[1] == 0xAA:
        # Busca u16 LE con hi=0 y lo en rango FC (común en estos protocolos).
        for i in range(4, min(len(data) - 1, 14)):
            lo = int(data[i])
            hi = int(data[i + 1])
            if hi == 0 and 30 <= lo <= 240:
                return lo
        for i in range(4, min(len(data), 12)):
            lo = int(data[i])
            if 40 <= lo <= 220:
                return lo

    return None


def infer_hr_from_session(packets: list[bytes]) -> int | None:
    """
    Respaldo: entre longitudes poco frecuentes (resultado, no onda),
    elige el offset cuyo valor mediano parece FC y no es una constante de onda.
    """
    if not packets:
        return None

    by_len: dict[int, list[bytes]] = defaultdict(list)
    for p in packets:
        by_len[len(p)].append(p)

    total = len(packets)
    # Longitudes "rápidas" (onda) suelen ser la mayoría.
    slow_lens = [L for L, items in by_len.items() if len(items) <= max(12, total * 0.15) and L >= 4]
    if not slow_lens:
        # Si todo es frecuente, igual intenta longitudes != 16
        slow_lens = [L for L in by_len if L != 16 and L >= 4]
    if not slow_lens:
        return None

    best: tuple[float, int, int] | None = None  # (score, median, offset)
    for L in sorted(slow_lens):
        items = by_len[L]
        if len(items) < 1:
            continue
        for offset in range(min(L, 16)):
            vals = [int(p[offset]) for p in items if 30 <= int(p[offset]) <= 240]
            if len(vals) < max(1, len(items) // 2):
                continue
            # Descarta la constante típica de onda (~34) si domina.
            common_val, common_n = Counter(vals).most_common(1)[0]
            if common_val <= 40 and common_n >= max(2, int(len(vals) * 0.7)):
                continue
            med = int(round(statistics.median(vals)))
            spread = max(vals) - min(vals) if len(vals) > 1 else 0
            # Prefiere FC fisiológica "de adulto midiendo" y algo de variación o estabilidad alta != 34
            score = (0 if 45 <= med <= 200 else -50) + min(spread, 30) + len(vals)
            if common_val == 34:
                score -= 100
            cand = (score, med, offset)
            if best is None or cand[0] > best[0]:
                best = cand
                print(
                    f"[ecg-bridge] infer L={L} offset={offset} median={med} vals={vals[:8]}…",
                    flush=True,
                )

    if best and best[0] > 0:
        return best[1]
    return None


def notification_handler(_sender: Any, data: bytearray) -> None:
    raw = bytes(data)
    with _lock:
        _raw_packets.append(raw)
    hr = extract_hr_from_packet(raw)
    note = f"hr={hr} " if hr is not None else ""
    _log_hex(raw, note)

    if hr is None:
        return

    with _lock:
        _pulse_samples.append(hr)
        n = len(_pulse_samples)
    if n == 1 or n % 2 == 0:
        set_progress(
            "measure",
            f"Midiendo… FC {hr} lpm ({n} lecturas). Dedos en las placas; luego Ya terminó.",
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
    global _patient_done, _pulse_samples, _raw_packets, _hex_logged

    with _lock:
        _pulse_samples = []
        _raw_packets = []
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
                "Conectado. Dedos en las placas del MD100C_P ~30 s. Cuando vea la FC en el aparato, toque Ya terminó.",
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
                    n = len(_pulse_samples)
                elapsed = time.monotonic() - started
                tick = int(elapsed)

                if done:
                    with _lock:
                        _patient_done = False
                    break

                # Solo auto-cierra si ya hay FC real (no basura de onda).
                if elapsed >= MIN_MEASURE_SEC and n >= MIN_SAMPLES:
                    set_progress("measure", f"Lectura lista ({n} FC). Cerrando…")
                    break

                if tick != last_tick and tick % 5 == 0:
                    last_tick = tick
                    set_progress(
                        "measure",
                        f"Midiendo MD100C_P… {tick} s · {n} FC válidas. Dedos en placas; luego Ya terminó.",
                    )
                await asyncio.sleep(0.35)
            else:
                raise RuntimeError(
                    "El MD100C_P tardó demasiado. Enciéndalo, dedos en las placas y toque Ya terminó."
                )

            with _lock:
                samples = list(_pulse_samples)
                packets = list(_raw_packets)

            if len(samples) < 1:
                inferred = infer_hr_from_session(packets)
                if inferred is not None:
                    print(f"[ecg-bridge] FC inferida del volcado: {inferred}", flush=True)
                    samples = [inferred]
                else:
                    lens = Counter(len(p) for p in packets)
                    print(f"[ecg-bridge] sin FC. packets={len(packets)} lens={dict(lens)}", flush=True)
                    raise RuntimeError(
                        "Se recibió onda BLE pero no la trama de frecuencia cardiaca. "
                        "Espere a ver la FC en la pantalla del MD100C_P y luego Ya terminó. "
                        "Revise ecg.out.log (líneas BLE#)."
                    )

            hr, rhythm, quality = summarize(samples)
            set_progress("idle", f"{rhythm} · FC {hr} lpm")
            return {
                "ok": True,
                "heartRate": hr,
                "rhythm": rhythm,
                "quality": quality,
                "source": "md100c_p",
                "samples": len(samples),
                "packets": len(packets),
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
                self._send(
                    200,
                    {
                        "ok": True,
                        "heartRate": 72,
                        "rhythm": "FC en rango normal (MD100C_P)",
                        "quality": "good",
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
        f"[ecg-bridge] MD100C_P BLE http://{HOST}:{PORT} address={TARGET_ADDRESS}",
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
