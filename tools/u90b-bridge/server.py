#!/usr/bin/env python3
"""
Bridge tensiómetro U90B Pro (BLE) → MaindHealth estación
http://127.0.0.1:3931

Protocolo (captura de estación):
  - Suscribe a notify/indicate de todas las características.
  - Medición final: data[3]=SYS, data[4]=DIA, data[5]=PULSE (mmHg / BPM).
  - Cierra solo tras ~2 s sin paquetes nuevos (o /continue).
"""

from __future__ import annotations

import asyncio
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

from bleak import BleakClient, BleakScanner

HOST = "127.0.0.1"
PORT = int(os.environ.get("BP_BRIDGE_PORT", "3931"))
TARGET_ADDRESS = os.environ.get("U90B_ADDRESS", "23:51:D6:CE:70:BB").strip()
READ_TIMEOUT_MS = int(os.environ.get("BP_READ_TIMEOUT_MS", "150000"))
IDLE_STOP_SEC = float(os.environ.get("U90B_IDLE_STOP_SEC", "2.0"))
SCAN_TIMEOUT_SEC = float(os.environ.get("U90B_SCAN_TIMEOUT_SEC", "8.0"))
NAME_KEYWORDS = ("bp", "urion", "alpha", "u90", "blood", "pressure", "alphamed")

_lock = threading.Lock()
_progress: dict[str, Any] = {
    "phase": "idle",
    "message": "Listo",
    "device": "u90b_pro",
}
_patient_done = False
_reading = False
_loop: asyncio.AbstractEventLoop | None = None
_packets: list[tuple[float, str, bytes]] = []
_last_packet_at: float | None = None


def set_progress(phase: str, message: str, **extra: Any) -> None:
    with _lock:
        _progress["phase"] = phase
        _progress["message"] = message
        _progress["device"] = "u90b_pro"
        for key, value in extra.items():
            _progress[key] = value


def get_progress() -> dict[str, Any]:
    with _lock:
        return dict(_progress)


def plausible(sys: int, dia: int, hr: int | None) -> bool:
    """Mismos rangos clínicos del bridge anterior (bp700 / station-bp)."""
    if not (sys >= 80 and sys <= 230 and dia >= 40 and dia <= 140 and sys > dia):
        return False
    if hr is None or hr == 0:
        return True
    return 40 <= hr <= 180


def parse_u90b_packet(data: bytes) -> dict[str, int] | None:
    if len(data) <= 5:
        return None
    sys = int(data[3])
    dia = int(data[4])
    hr = int(data[5])
    if not plausible(sys, dia, hr):
        return None
    return {
        "sys": sys,
        "dia": dia,
        "hr": hr if 40 <= hr <= 180 else 0,
    }


def notification_handler(char_uuid: str, data: bytearray) -> None:
    global _last_packet_at
    raw = bytes(data)
    now = time.time()
    with _lock:
        _packets.append((now, char_uuid, raw))
        _last_packet_at = now
        n = len(_packets)
    hx = raw.hex("-")
    print(f"[u90b-bridge] BLE#{n} {char_uuid} len={len(raw)} [{hx}]", flush=True)
    parsed = parse_u90b_packet(raw)
    if parsed:
        set_progress(
            "measure",
            f"Recibido {parsed['sys']}/{parsed['dia']} mmHg"
            + (f" · FC {parsed['hr']}" if parsed["hr"] else "")
            + ". Espere estabilizar…",
            packets=n,
            lastSys=parsed["sys"],
            lastDia=parsed["dia"],
        )
    else:
        set_progress("measure", f"Datos BLE ({n} paquetes). Siga midiendo…", packets=n)


async def find_device(mac: str):
    print(f"[u90b-bridge] buscando {mac}…", flush=True)
    set_progress("connect", f"Buscando U90B Pro ({mac})…")
    try:
        by_mac = await BleakScanner.find_device_by_address(mac, timeout=SCAN_TIMEOUT_SEC)
        if by_mac:
            print(f"[u90b-bridge] encontrado por MAC: {by_mac.address}", flush=True)
            return by_mac
    except Exception as err:
        print(f"[u90b-bridge] scan MAC: {err}", flush=True)

    set_progress("connect", "MAC no vista. Escaneando tensiómetros cercanos…")
    devices = await BleakScanner.discover(timeout=max(6.0, SCAN_TIMEOUT_SEC - 2))
    for d in devices:
        name = (d.name or "").lower()
        if any(k in name for k in NAME_KEYWORDS):
            print(f"[u90b-bridge] por nombre '{d.name}' ({d.address})", flush=True)
            return d

    strong = [d for d in devices if getattr(d, "rssi", None) is not None and d.rssi > -55]
    if strong:
        strong.sort(key=lambda x: x.rssi, reverse=True)
        best = strong[0]
        print(
            f"[u90b-bridge] candidato cercano '{best.name}' ({best.address}) RSSI={best.rssi}",
            flush=True,
        )
        return best
    return None


async def subscribe_all(client: BleakClient) -> int:
    count = 0
    for service in client.services:
        for char in service.characteristics:
            props = list(char.properties or [])
            if "notify" not in props and "indicate" not in props:
                continue
            uuid = char.uuid

            def make_cb(u: str = uuid):
                return lambda _sender, data: notification_handler(u, data)

            try:
                await client.start_notify(uuid, make_cb())
                print(f"[u90b-bridge] notify ON {uuid}", flush=True)
                count += 1
            except Exception as err:
                print(f"[u90b-bridge] notify fail {uuid}: {err}", flush=True)
    return count


def pick_final_reading() -> dict[str, int]:
    with _lock:
        packets = list(_packets)
    if not packets:
        raise RuntimeError(
            "No llegaron datos del U90B Pro. Enciéndalo, introduzca el brazo en el túnel y pulse START."
        )

    # Preferir el último paquete parseable (medición final).
    for _t, _uuid, raw in reversed(packets):
        parsed = parse_u90b_packet(raw)
        if parsed:
            return parsed

    last = packets[-1][2]
    raise RuntimeError(
        "Se recibieron bytes BLE pero no una medición válida (SYS/DIA). "
        f"Último paquete len={len(last)} hex={last.hex('-')}. Repita la medición."
    )


async def measure_once() -> dict[str, Any]:
    global _patient_done, _packets, _last_packet_at

    with _lock:
        _packets = []
        _last_packet_at = None
        _patient_done = False

    mac = TARGET_ADDRESS
    device = await find_device(mac)
    if device is None:
        raise RuntimeError(
            f"No se encontró el U90B Pro ({mac}). "
            "Enciéndalo cerca de la PC, Bluetooth activo, y pulse START."
        )

    address = getattr(device, "address", None) or mac
    name = getattr(device, "name", None) or "U90B Pro"
    set_progress("connect", f"Conectando a {name} ({address})…")

    deadline = time.monotonic() + (READ_TIMEOUT_MS / 1000.0)

    try:
        async with BleakClient(device, timeout=20.0) as client:
            if not client.is_connected:
                raise RuntimeError(f"No se pudo conectar al U90B Pro ({address}).")

            subscribed = await subscribe_all(client)
            if subscribed == 0:
                raise RuntimeError(
                    "El U90B Pro no expuso características de notificación BLE."
                )

            set_progress(
                "measure",
                "Conectado. Introduzca el brazo en el túnel, pulse START en el U90B Pro y espere el número.",
                address=address,
            )

            started = time.monotonic()
            last_tick = -1
            while time.monotonic() < deadline:
                done = False
                with _lock:
                    done = _patient_done
                    last_at = _last_packet_at
                    n = len(_packets)

                if done:
                    with _lock:
                        _patient_done = False
                    break

                if last_at is not None and (time.time() - last_at) >= IDLE_STOP_SEC:
                    # Solo cerrar si ya hay al menos una medición plausible.
                    try:
                        pick_final_reading()
                        set_progress("measure", "Medición estable. Cerrando…", packets=n)
                        break
                    except RuntimeError:
                        pass

                elapsed = int(time.monotonic() - started)
                if elapsed != last_tick and elapsed % 5 == 0:
                    last_tick = elapsed
                    set_progress(
                        "measure",
                        f"Esperando U90B Pro… {elapsed} s · {n} paquetes. "
                        "Brazo en el túnel; pulse START; luego Ya vi el resultado si ya ve el número.",
                        packets=n,
                    )
                await asyncio.sleep(0.2)
            else:
                raise RuntimeError(
                    "El U90B Pro tardó demasiado. Enciéndalo, pulse START y espere el resultado."
                )

            reading = pick_final_reading()
            sys = reading["sys"]
            dia = reading["dia"]
            hr = reading["hr"] or None
            if hr is not None and not (40 <= hr <= 180):
                hr = None

            msg = f"Listo: {sys}/{dia} mmHg" + (f" · FC {hr}" if hr else "")
            set_progress("idle", msg, packets=len(_packets))
            with _lock:
                packet_count = len(_packets)

            return {
                "ok": True,
                "systolicPressure": sys,
                "diastolicPressure": dia,
                "heartRate": hr,
                "format": "u90b",
                "bytes": packet_count,
                "source": "u90b_pro",
                "address": address,
                "deviceName": name,
            }
    except Exception as err:
        msg = str(err) or err.__class__.__name__
        low = msg.lower()
        if any(
            x in low
            for x in ("not found", "could not", "failed to connect", "timeout", "disconnected")
        ):
            msg = (
                f"No se pudo usar el U90B Pro ({address if 'address' in locals() else mac}). "
                "Enciéndalo cerca, Bluetooth activo, pulse START e intente de nuevo."
            )
        set_progress("idle", msg)
        raise RuntimeError(msg) from err


def run_measure_sync() -> dict[str, Any]:
    if _loop is None:
        raise RuntimeError("El bucle BLE no está listo.")
    fut = asyncio.run_coroutine_threadsafe(measure_once(), _loop)
    return fut.result(timeout=(READ_TIMEOUT_MS / 1000.0) + 45)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[u90b-bridge] {self.address_string()} - {fmt % args}", flush=True)

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
                    "device": "u90b_pro",
                    "address": TARGET_ADDRESS,
                    "plugged": True,
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
                        "systolicPressure": 118,
                        "diastolicPressure": 76,
                        "heartRate": 72,
                        "source": "u90b_pro",
                        "simulated": True,
                    },
                )
                return

            with _lock:
                if _reading:
                    self._send(
                        409,
                        {"ok": False, "error": "Ya hay una lectura de presión en curso."},
                    )
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
        f"[u90b-bridge] U90B Pro BLE http://{HOST}:{PORT} address={TARGET_ADDRESS}",
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
