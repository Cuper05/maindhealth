/**
 * Servicio local de estación — CMS50D+
 * Escucha en http://127.0.0.1:3927 para que MaindHealth lea el oxímetro
 * sin depender de Web Serial en el navegador.
 *
 *   node server.mjs
 */

import http from "node:http";
import { SerialPort } from "serialport";

const HOST = "127.0.0.1";
const PORT = Number(process.env.BRIDGE_PORT || 3927);
const DEFAULT_SERIAL_PATH = process.env.CMS50_PORT || "";
const BAUDS = [19200, 115200];

function parseClassic5(buffer) {
  const readings = [];
  for (let i = 0; i < buffer.length - 4; i++) {
    const b0 = buffer[i];
    if ((b0 & 0x80) === 0) continue;
    const b1 = buffer[i + 1];
    const b2 = buffer[i + 2];
    const b3 = buffer[i + 3];
    const b4 = buffer[i + 4];
    if (b1 & 0x80 || b2 & 0x80 || b3 & 0x80 || b4 & 0x80) continue;
    if (b4 >= 70 && b4 <= 100 && b3 >= 30 && b3 <= 250) {
      readings.push({ spo2: b4, hr: b3 });
      i += 4;
    }
  }
  return readings;
}

function stableOf(window, need = 3) {
  if (window.length < need) return null;
  const recent = window.slice(-need);
  const spo2 = recent.map((r) => r.spo2);
  const hr = recent.map((r) => r.hr);
  if (Math.max(...spo2) - Math.min(...spo2) > 3) return null;
  if (Math.max(...hr) - Math.min(...hr) > 15) return null;
  const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  return { spo2: avg(spo2), hr: avg(hr) };
}

async function pickPort() {
  if (DEFAULT_SERIAL_PATH) return DEFAULT_SERIAL_PATH;
  const ports = await SerialPort.list();
  const preferred = ports.find((p) => {
    const blob = `${p.friendlyName || ""} ${p.manufacturer || ""}`.toLowerCase();
    return blob.includes("cp210") || blob.includes("silicon");
  });
  if (preferred) return preferred.path;
  const nonAmt = ports.find(
    (p) => !`${p.friendlyName || ""}`.toLowerCase().includes("active management"),
  );
  return nonAmt?.path || null;
}

function openPort(path, baudRate) {
  const port = new SerialPort({
    path,
    baudRate,
    dataBits: 8,
    parity: "none",
    stopBits: 1,
    autoOpen: false,
  });
  return new Promise((resolve, reject) => {
    port.open((err) => (err ? reject(err) : resolve(port)));
  });
}

async function readOnce(maxMs = 12000) {
  const path = await pickPort();
  if (!path) {
    throw new Error("No hay puerto COM del oxímetro (Silicon Labs).");
  }

  const startCmd = Buffer.from([0x7d, 0x81, 0xa1, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]);

  for (const baudRate of BAUDS) {
    const port = await openPort(path, baudRate);
    try {
      port.write(startCmd);
      const window = [];
      let buffer = Buffer.alloc(0);
      const sample = await new Promise((resolve) => {
        const timer = setTimeout(() => {
          cleanup();
          resolve(null);
        }, maxMs);

        const ping = setInterval(() => port.write(startCmd), 700);

        const onData = (chunk) => {
          buffer = Buffer.concat([buffer, chunk]);
          if (buffer.length > 8192) buffer = buffer.subarray(buffer.length - 4096);
          for (const r of parseClassic5(buffer)) window.push(r);
          const stable = stableOf(window, 3);
          if (stable) {
            cleanup();
            resolve({ ...stable, port: path, baudRate });
          }
        };

        const cleanup = () => {
          clearTimeout(timer);
          clearInterval(ping);
          port.off("data", onData);
        };

        port.on("data", onData);
      });

      await new Promise((r) => port.close(() => r()));
      if (sample) return sample;
    } catch (err) {
      try {
        await new Promise((r) => port.close(() => r()));
      } catch {
        /* ignore */
      }
      throw err;
    }
  }

  throw new Error("Sin lectura estable. Oxímetro encendido y dedo puesto.");
}

/** CORS + Private Network Access (Chrome exige esto desde https://health… → 127.0.0.1) */
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
  };
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    ...corsHeaders(),
  });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    const ports = await SerialPort.list();
    sendJson(res, 200, {
      ok: true,
      service: "cms50dplus-bridge",
      ports: ports.map((p) => ({
        path: p.path,
        name: p.friendlyName || p.manufacturer || "",
      })),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/read") {
    try {
      const sample = await readOnce(12000);
      sendJson(res, 200, {
        ok: true,
        oxygenSaturation: sample.spo2,
        heartRate: sample.hr,
        port: sample.port,
        baudRate: sample.baudRate,
      });
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        error: err instanceof Error ? err.message : "Error de lectura",
      });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`CMS50D+ bridge listo en http://${HOST}:${PORT}`);
  console.log("Health: GET /health");
  console.log("Leer:   POST /read");
});
