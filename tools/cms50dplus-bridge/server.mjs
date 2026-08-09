/**
 * Servicio local de estación — CMS50D+
 * Escucha en http://127.0.0.1:3927 para que MaindHealth lea el oxímetro
 * sin depender de Web Serial en el navegador.
 *
 *   node server.mjs
 *   (dejar la ventana abierta)
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
      readings.push({ spo2: b4, hr: b3, format: "classic5" });
      i += 4;
    }
  }
  return readings;
}

/** Protocolo v7: trama 9 bytes con bits de sincronización. */
function parseV7(buffer) {
  const readings = [];
  for (let i = 0; i < buffer.length - 8; i++) {
    if (buffer[i] & 0x80) continue;
    if (!(buffer[i + 1] & 0x80)) continue;
    let syncOk = true;
    for (let j = 2; j < 9; j++) {
      if (!(buffer[i + j] & 0x80)) {
        syncOk = false;
        break;
      }
    }
    if (!syncOk) continue;
    const packageType = buffer[i];
    if (packageType !== 0x01) continue;
    const high = buffer[i + 1];
    const pkg = [];
    for (let j = 0; j < 7; j++) {
      let b = buffer[i + 2 + j] & 0x7f;
      if (high & (1 << j)) b |= 0x80;
      pkg.push(b);
    }
    const hr = pkg[3];
    const spo2 = pkg[4];
    if (spo2 >= 70 && spo2 <= 100 && hr >= 30 && hr <= 250 && spo2 !== 0x7f && hr !== 0xff) {
      readings.push({ spo2, hr, format: "v7" });
    }
  }
  return readings;
}

function parseLoose(buffer) {
  const readings = [];
  for (let i = 0; i < buffer.length - 8; i++) {
    if (buffer[i] !== 0x01 && buffer[i] !== 0x81) continue;
    for (let a = i + 1; a < i + 8 && a < buffer.length; a++) {
      for (let b = a + 1; b < i + 9 && b < buffer.length; b++) {
        const spo2 = buffer[a];
        const hr = buffer[b];
        if (spo2 >= 85 && spo2 <= 100 && hr >= 40 && hr <= 180) {
          readings.push({ spo2, hr, format: "loose" });
        }
      }
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

function realtimeCommands() {
  return [
    Buffer.from([0x7d, 0x81, 0xa6, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]),
    Buffer.from([0x7d, 0x81, 0xa2, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]),
    Buffer.from([0x7d, 0x81, 0xa7, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]),
    Buffer.from([0x7d, 0x81, 0xa1, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]),
    Buffer.from([0x7d, 0x81, 0xa0, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]),
  ];
}

const START_CMD = Buffer.from([0x7d, 0x81, 0xa1, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]);
const KEEP_CMD = Buffer.from([0x7d, 0x81, 0xaf, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]);

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

function setSignals(port, dtr, rts) {
  return new Promise((resolve) => {
    port.set({ dtr, rts }, () => resolve());
  });
}

async function readOnce(maxMs = 15000) {
  const path = await pickPort();
  if (!path) {
    throw Object.assign(new Error("No hay puerto COM del oxímetro (Silicon Labs)."), {
      code: "NO_PORT",
      bytes: 0,
    });
  }

  let lastBytes = 0;
  let lastBaud = BAUDS[0];

  for (const baudRate of BAUDS) {
    lastBaud = baudRate;
    const port = await openPort(path, baudRate);
    try {
      await setSignals(port, false, false);
      await new Promise((r) => setTimeout(r, 80));
      await setSignals(port, true, false);
      await new Promise((r) => setTimeout(r, 120));

      for (const cmd of realtimeCommands()) {
        port.write(cmd);
        await new Promise((r) => setTimeout(r, 50));
      }

      const window = [];
      let buffer = Buffer.alloc(0);
      let bytes = 0;

      const sample = await new Promise((resolve) => {
        const timer = setTimeout(() => {
          cleanup();
          resolve(null);
        }, maxMs);

        const ping = setInterval(() => {
          port.write(START_CMD);
          port.write(KEEP_CMD);
        }, 700);

        const onData = (chunk) => {
          bytes += chunk.length;
          lastBytes = bytes;
          buffer = Buffer.concat([buffer, chunk]);
          if (buffer.length > 8192) buffer = buffer.subarray(buffer.length - 4096);
          for (const r of [...parseClassic5(buffer), ...parseV7(buffer), ...parseLoose(buffer)]) {
            window.push(r);
          }
          const stable = stableOf(window, 3);
          if (stable) {
            cleanup();
            resolve({ ...stable, port: path, baudRate, bytes, format: window[window.length - 1]?.format });
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
      console.log(`[read] ${path} @ ${baudRate}: bytes=${bytes} (sin SpO2 estable)`);
    } catch (err) {
      try {
        await new Promise((r) => port.close(() => r()));
      } catch {
        /* ignore */
      }
      const msg = err instanceof Error ? err.message : String(err);
      if (/Access denied|cannot open|ENOENT|busy/i.test(msg)) {
        throw Object.assign(
          new Error(
            "COM ocupado. Cierra Chrome/Edge con el puerto USB, cierra leer-oximetro.bat y reintenta.",
          ),
          { code: "PORT_BUSY", bytes: 0, port: path },
        );
      }
      throw err;
    }
  }

  throw Object.assign(
    new Error(
      lastBytes === 0
        ? `0 bytes desde ${path}. Enciende el oxímetro (pantalla con números), pon el dedo y espera 5 s. El chip USB puede verse aunque el aparato esté apagado.`
        : `Hubo ${lastBytes} bytes @ ${lastBaud} pero sin SpO2/FC estable. Mantén el dedo firme.`,
    ),
    { code: lastBytes === 0 ? "NO_BYTES" : "NO_STABLE", bytes: lastBytes, port: path, baudRate: lastBaud },
  );
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
    console.log(`[${new Date().toISOString()}] POST /read`);
    try {
      const sample = await readOnce(15000);
      console.log(
        `[read] OK SpO2=${sample.spo2} FC=${sample.hr} @ ${sample.baudRate} bytes=${sample.bytes}`,
      );
      sendJson(res, 200, {
        ok: true,
        oxygenSaturation: sample.spo2,
        heartRate: sample.hr,
        port: sample.port,
        baudRate: sample.baudRate,
        bytes: sample.bytes,
        format: sample.format,
      });
    } catch (err) {
      const bytes = typeof err?.bytes === "number" ? err.bytes : 0;
      const message = err instanceof Error ? err.message : "Error de lectura";
      console.log(`[read] FAIL bytes=${bytes}: ${message}`);
      sendJson(res, 500, {
        ok: false,
        error: message,
        bytes,
        code: err?.code || "READ_FAIL",
        port: err?.port,
      });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, async () => {
  const path = await pickPort();
  console.log(`CMS50D+ bridge listo en http://${HOST}:${PORT}`);
  console.log(`Puerto preferido: ${path || "(ninguno)"}`);
  console.log("Health: GET /health");
  console.log("Leer:   POST /read");
  console.log("Deja esta ventana ABIERTA. En Chrome permite 'red local' / local network si lo pide.");
});
