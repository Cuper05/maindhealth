#!/usr/bin/env python3
"""
Bridge K3 Pro (USB serial) → MaindHealth estación
http://127.0.0.1:3933

El K3 Pro manda mucho texto de depuración. Solo usamos la ÚLTIMA línea:
  T body = 36.535 C, ...
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, urlparse

import serial

HOST = "127.0.0.1"
PORT = int(os.environ.get("K3PRO_BRIDGE_PORT") or os.environ.get("THERMO_BRIDGE_PORT") or "3933")
SERIAL_PORT = os.environ.get("K3PRO_PORT", "COM8").strip()
BAUD = int(os.environ.get("K3PRO_BAUD", "115200"))
READ_TIMEOUT_MS = int(os.environ.get("K3PRO_READ_TIMEOUT_MS", "90000"))
SILENCE_AFTER_BODY_S = float(os.environ.get("K3PRO_SILENCE_S", "1.2"))

BODY_RE = re.compile(r"T\s*body\s*=\s*([0-9]+(?:\.[0-9]+)?)\s*C", re.IGNORECASE)

_lock = threading.Lock()
_progress: dict[str, Any] = {
    "phase": "idle",
    "message": "Listo",
    "device": "k3pro",
    "port": SERIAL_PORT,
}
_reading = False


def set_progress(phase: str, message: str, **extra: Any) -> None:
    with _lock:
        _progress["phase"] = phase
        _progress["message"] = message
        _progress["device"] = "k3pro"
        _progress["port"] = SERIAL_PORT
        for k, v in extra.items():
            _progress[k] = v


def get_progress() -> dict[str, Any]:
    with _lock:
        return dict(_progress)


def probe_port() -> bool:
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD, timeout=0.2)
        ser.close()
        return True
    except Exception:
        return False


def read_body_temperature() -> dict[str, Any]:
    set_progress(
        "wait",
        f"Escuchando {SERIAL_PORT}. Acérquese al K3 Pro (frente a 5–10 cm)…",
    )
    deadline = time.monotonic() + (READ_TIMEOUT_MS / 1000.0)
    last_body: float | None = None
    last_body_at = 0.0
    saw_away = False
    buf = ""

    try:
        ser = serial.Serial(SERIAL_PORT, BAUD, timeout=0.2)
    except Exception as err:
        raise RuntimeError(
            f"No se pudo abrir {SERIAL_PORT}. Encienda el K3 Pro y verifique el USB ({err})."
        ) from err

    try:
        try:
            ser.reset_input_buffer()
        except Exception:
            pass

        while time.monotonic() < deadline:
            chunk = ser.read(512)
            if chunk:
                text = chunk.decode("utf-8", errors="replace")
                # También loguea ASCII útil (sin inundar).
                for line in text.replace("\r", "").split("\n"):
                    line = line.strip()
                    if not line:
                        continue
                    if line.lower().startswith("t body") or "proximity" in line.lower() or line in (
                        "Close",
                        "Away",
                        "L",
                    ):
                        print(f"[k3pro] {line}", flush=True)

                buf += text
                # Procesa líneas completas
                while "\n" in buf or "\r" in buf:
                    if "\n" in buf:
                        line, buf = buf.split("\n", 1)
                    else:
                        line, buf = buf.split("\r", 1)
                    line = line.strip()
                    if not line:
                        continue

                    m = BODY_RE.search(line)
                    if m:
                        last_body = float(m.group(1))
                        last_body_at = time.monotonic()
                        saw_away = False
                        set_progress(
                            "measure",
                            f"Temperatura corporal {last_body:.1f} °C. Espere a que termine…",
                            temperature=last_body,
                        )

                    if line.strip().lower() == "away" and last_body is not None:
                        saw_away = True
                        break

            if last_body is not None:
                if saw_away:
                    break
                if time.monotonic() - last_body_at >= SILENCE_AFTER_BODY_S:
                    break

            time.sleep(0.05)
        else:
            if last_body is None:
                raise RuntimeError(
                    "Sin lectura del K3 Pro. Enciéndalo, acérquese de frente a 5–10 cm y espere el pitido."
                )

        if last_body is None:
            raise RuntimeError("El K3 Pro no envió T body. Verifique modo corporal (body).")

        # Rango clínico razonable para frente / corporal
        if not (30.0 <= last_body <= 45.0):
            raise RuntimeError(f"Temperatura fuera de rango: {last_body:.1f} °C")

        set_progress("idle", f"{last_body:.1f} °C", temperature=last_body)
        return {
            "ok": True,
            "temperature": round(last_body, 1),
            "connected": True,
            "device": "k3pro",
            "port": SERIAL_PORT,
            "unit": "C",
        }
    finally:
        try:
            ser.close()
        except Exception:
            pass


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[k3pro-bridge] {self.address_string()} - {fmt % args}", flush=True)

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
            ok = probe_port()
            self._send(
                200,
                {
                    "ok": ok,
                    "device": "k3pro",
                    "port": SERIAL_PORT,
                    "baud": BAUD,
                    **get_progress(),
                },
            )
            return
        if path == "/progress":
            self._send(200, {"ok": True, **get_progress()})
            return
        self._send(404, {"ok": False, "error": "Not found"})

    def do_POST(self) -> None:  # noqa: N802
        global _reading
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)
        body = self._read_json()

        if path == "/read":
            simulate = qs.get("simulate", ["0"])[0] == "1" or body.get("simulate") is True
            if simulate:
                self._send(
                    200,
                    {
                        "ok": True,
                        "temperature": 36.5,
                        "connected": True,
                        "device": "k3pro",
                        "simulated": True,
                    },
                )
                return

            with _lock:
                if _reading:
                    self._send(409, {"ok": False, "error": "Ya hay una lectura de temperatura en curso."})
                    return
                _reading = True

            try:
                result = read_body_temperature()
                self._send(200, result)
            except Exception as err:
                set_progress("idle", str(err))
                self._send(503, {"ok": False, "error": str(err), "connected": probe_port()})
            finally:
                with _lock:
                    _reading = False
            return

        self._send(404, {"ok": False, "error": "Not found"})


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(
        f"[k3pro-bridge] K3 Pro serial http://{HOST}:{PORT} port={SERIAL_PORT} baud={BAUD}",
        flush=True,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
