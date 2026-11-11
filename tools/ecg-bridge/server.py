#!/usr/bin/env python3
"""
Bridge MD100C_P (BLE) → MaindHealth estación
http://127.0.0.1:3928

Misma API que el bridge anterior del PC-80B:
  GET  /health
  GET  /progress
  POST /continue   → el paciente tocó «Ya terminó»
  POST /read       → conectar, medir ~30 s, devolver FC + etiqueta clínica
"""

from __future__ import annotations

import asyncio
import json
import os
import statistics
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from bleak import BleakClient

HOST = "127.0.0.1"
PORT = int(os.environ.get("ECG_BRIDGE_PORT", "3928"))
# MAC fija del MD100C_P de esta estación (script ecg.py).
TARGET_ADDRESS = os.environ.get("ECG_MD100C_ADDRESS", "FB:1E:E4:A4:03:00").strip()
READ_TIMEOUT_MS = int(os.environ.get("ECG_READ_TIMEOUT_MS", "150000"))
MIN_SAMPLES = int(os.environ.get("ECG_MIN_SAMPLES", "8"))
MIN_MEASURE_SEC = float(os.environ.get("ECG_MIN_MEASURE_SEC", "25"))

# Comandos de activación descubiertos en ecg.py
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
    """Etiqueta útil para el análisis médico a partir de la FC del MD100C_P."""
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
    if len(samples) < MIN_SAMPLES:
        raise RuntimeError(
            f"Pocos pulsos válidos ({len(samples)}). Mantenga el dedo firme ~30 s y toque Ya terminó."
        )
    # Mediana: más estable ante picos raros del BLE.
    hr = int(round(statistics.median(samples)))
    if not (30 <= hr <= 220):
        raise RuntimeError("Frecuencia cardiaca fuera de rango. Reintente con el dedo bien colocado.")
    return hr, rhythm_from_hr(hr), quality_from_samples(samples)


def notification_handler(_sender: Any, data: bytearray) -> None:
    """Misma extracción de pulso que ecg.py: data[3] si está en rango lógico."""
    if len(data) < 4:
        return
    pulse = int(data[3])
    if 30 <= pulse <= 200:
        with _lock:
            _pulse_samples.append(pulse)
            n = len(_pulse_samples)
        if n == 1 or n % 4 == 0:
            set_progress(
                "measure",
                f"Midiendo… FC {pulse} lpm ({n} muestras). Mantenga el dedo ~30 s y toque Ya terminó.",
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
                except Exception:
                    pass


async def _subscribe_all(client: BleakClient) -> None:
    for service in client.services:
        for char in service.characteristics:
            props = char.properties or []
            if "notify" not in props and "indicate" not in props:
                continue
            try:
                await client.start_notify(char.uuid, notification_handler)
            except Exception:
                pass


async def measure_once() -> dict[str, Any]:
    global _patient_done, _pulse_samples

    with _lock:
        _pulse_samples = []
        _patient_done = False

    set_progress("connect", f"Conectando al MD100C_P ({TARGET_ADDRESS})…")
    deadline = time.monotonic() + (READ_TIMEOUT_MS / 1000.0)

    try:
        async with BleakClient(TARGET_ADDRESS, timeout=25.0) as client:
            if not client.is_connected:
                raise RuntimeError("No se pudo conectar al MD100C_P por Bluetooth.")

            set_progress(
                "measure",
                "Conectado. Coloque el dedo en el sensor MD100C_P. Espere ~30 s y toque Ya terminó.",
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

                # Flujo kiosko: el paciente toca «Ya terminó» tras ~30 s.
                if done:
                    with _lock:
                        _patient_done = False
                    break

                # Si ya hay muestras estables y pasaron ~30 s, cerrar solo
                # (por si no tocan el botón a tiempo).
                if elapsed >= MIN_MEASURE_SEC and n >= MIN_SAMPLES:
                    set_progress("measure", f"Lectura lista ({n} muestras). Cerrando…")
                    break

                if tick != last_tick and tick % 5 == 0:
                    last_tick = tick
                    set_progress(
                        "measure",
                        f"Midiendo con MD100C_P… {tick} s · {n} muestras. Dedo quieto; luego Ya terminó.",
                    )
                await asyncio.sleep(0.35)
            else:
                raise RuntimeError(
                    "El MD100C_P tardó demasiado. Enciéndalo, coloque el dedo y toque Ya terminó."
                )

            with _lock:
                samples = list(_pulse_samples)

            hr, rhythm, quality = summarize(samples)
            set_progress("idle", f"{rhythm} · FC {hr} lpm")
            return {
                "ok": True,
                "heartRate": hr,
                "rhythm": rhythm,
                "quality": quality,
                "source": "md100c_p",
                "samples": len(samples),
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
    # Espera breve a que el loop exista.
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
