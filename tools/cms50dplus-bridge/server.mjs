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
const BAUDS = [115200, 19200];
const MONITOR_URL = process.env.CMS_LAN_URL || "http://127.0.0.1:3932";

async function readFromEthernetMonitor(maxMs = 70000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), maxMs);
  try {
    const res = await fetch(`${MONITOR_URL}/read?kind=spo2`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(
        data.error ||
          "El monitor no envió SpO₂. Coloque el clip de dedo del monitor y espere números en pantalla.",
      );
    }
    const spo2 = Number(data.spo2);
    const hr = Number(data.heartRate);
    if (!(spo2 >= 70 && spo2 <= 100) || !(hr >= 30 && hr <= 220)) {
      throw new Error("El monitor no envió SpO₂ y pulso válidos. Deje el dedo en el sensor.");
    }
    return { spo2, hr, port: "cms-lan", baudRate: 0, bytes: 0, format: "cms-lan" };
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError") {
      throw new Error("SpO₂ tardó demasiado. Deje el dedo en el sensor del monitor.");
    }
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    clearTimeout(timer);
  }
}

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

/**
 * Acepta cuando SpO2 ya casi no se mueve (±1) en los ultimos ~3 s.
 * (Antes fallaba: need=8 con throttle 250ms nunca llegaba a span 2.5s.)
 */
function stableOf(window) {
  if (window.length < 6) return null;
  const latestAt = window[window.length - 1].at;
  const firstAt = window[0].at;
  // Calentamiento: al menos 4 s desde el primer paquete util.
  if (latestAt - firstAt < 4000) return null;

  const slice = window.filter((r) => latestAt - r.at <= 3000);
  if (slice.length < 6) return null;

  const spo2Vals = slice.map((r) => r.spo2);
  const hrVals = slice.map((r) => r.hr);
  if (Math.max(...spo2Vals) - Math.min(...spo2Vals) > 1) return null;
  if (Math.max(...hrVals) - Math.min(...hrVals) > 8) return null;

  const spo2 = spo2Vals[spo2Vals.length - 1];
  if (spo2 < 90 || spo2 > 100) return null;
  const hrSorted = [...hrVals].sort((a, b) => a - b);
  const hr = hrSorted[Math.floor(hrSorted.length / 2)];
  if (hr < 40 || hr > 180) return null;
  return { spo2, hr };
}

/** Parsea solo bytes nuevos y consume paquetes del buffer. */
function consumeReadings(buffer) {
  const readings = [];
  let i = 0;
  while (i < buffer.length) {
    // classic5
    if (i + 4 < buffer.length && buffer[i] & 0x80) {
      const b1 = buffer[i + 1];
      const b2 = buffer[i + 2];
      const b3 = buffer[i + 3];
      const b4 = buffer[i + 4];
      if (!(b1 & 0x80) && !(b2 & 0x80) && !(b3 & 0x80) && !(b4 & 0x80)) {
        if (b4 >= 90 && b4 <= 100 && b3 >= 40 && b3 <= 180) {
          readings.push({ spo2: b4, hr: b3, format: "classic5" });
          i += 5;
          continue;
        }
      }
    }
    // v7
    if (i + 8 < buffer.length && !(buffer[i] & 0x80) && buffer[i + 1] & 0x80 && buffer[i] === 0x01) {
      let syncOk = true;
      for (let j = 2; j < 9; j++) {
        if (!(buffer[i + j] & 0x80)) {
          syncOk = false;
          break;
        }
      }
      if (syncOk) {
        const high = buffer[i + 1];
        const pkg = [];
        for (let j = 0; j < 7; j++) {
          let b = buffer[i + 2 + j] & 0x7f;
          if (high & (1 << j)) b |= 0x80;
          pkg.push(b);
        }
        const hr = pkg[3];
        const spo2 = pkg[4];
        if (spo2 >= 90 && spo2 <= 100 && hr >= 40 && hr <= 180 && spo2 !== 0x7f && hr !== 0xff) {
          readings.push({ spo2, hr, format: "v7" });
          i += 9;
          continue;
        }
      }
    }
    i += 1;
  }
  // Conservar cola corta por si quedó un paquete a medias.
  const keep = Math.min(buffer.length, 16);
  const rest = buffer.subarray(buffer.length - keep);
  return { readings, rest };
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
  const ports = await SerialPort.list();
  if (DEFAULT_SERIAL_PATH) {
    const configured = ports.find(
      (p) => (p.path || "").toUpperCase() === DEFAULT_SERIAL_PATH.toUpperCase(),
    );
    if (configured) return configured.path;
  }
  const preferred = ports.find((p) => {
    const blob = `${p.friendlyName || ""} ${p.manufacturer || ""}`.toLowerCase();
    return blob.includes("cp210") || blob.includes("silicon");
  });
  if (preferred) return preferred.path;
  // No usar CH340: ese adaptador es de la báscula.
  return null;
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

async function readOnce(maxMs = 35000) {
  const path = await pickPort();
  if (!path) {
    throw Object.assign(new Error("No hay puerto COM del oxímetro (Silicon Labs)."), {
      code: "NO_PORT",
      bytes: 0,
    });
  }

  let lastBytes = 0;
  let lastBaud = BAUDS[0];
  const deadline = Date.now() + maxMs;

  for (const baudRate of BAUDS) {
    const remaining = deadline - Date.now();
    if (remaining < 5000) break;
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
      const baudBudget = Math.min(remaining, 28000);

      const sample = await new Promise((resolve) => {
        const timer = setTimeout(() => {
          cleanup();
          resolve(null);
        }, baudBudget);

        const ping = setInterval(() => {
          port.write(START_CMD);
          port.write(KEEP_CMD);
        }, 700);

        const onData = (chunk) => {
          bytes += chunk.length;
          lastBytes = bytes;
          buffer = Buffer.concat([buffer, chunk]);
          const { readings, rest } = consumeReadings(buffer);
          buffer = Buffer.from(rest);
          if (readings.length === 0) return;
          const now = Date.now();
          for (const latest of readings) {
            const prev = window[window.length - 1];
            if (prev && now - prev.at < 250) continue;
            window.push({ spo2: latest.spo2, hr: latest.hr, format: latest.format, at: now });
            if (window.length === 1 || window.length % 5 === 0) {
              console.log(
                `[signal] SpO2=${latest.spo2} FC=${latest.hr} (${latest.format}) n=${window.length} — meseta…`,
              );
            }
          }
          const stable = stableOf(window);
          if (stable) {
            cleanup();
            resolve({
              ...stable,
              port: path,
              baudRate,
              bytes,
              format: window[window.length - 1]?.format,
            });
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
      // Si este baud ya trajo flujo v7, no reinventar con otro baud.
      if (bytes > 1000) break;
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
            "COM ocupado. Espere 5 s y pulse Leer oxímetro una sola vez (no abra otros .bat).",
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
        ? `0 bytes desde ${path}. Enciende el oxímetro (pantalla con números), pon el dedo y espera 5 s.`
        : `Hubo datos pero SpO₂ no se estabilizó. Mantén el dedo firme 10 s y reintenta.`,
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

let readBusy = false;

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
      busy: readBusy,
      configuredPort: DEFAULT_SERIAL_PATH || null,
      resolvedPort: await pickPort(),
      fallback: (await pickPort()) ? "usb" : "cms-lan",
      ports: ports.map((p) => ({
        path: p.path,
        name: p.friendlyName || p.manufacturer || "",
      })),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/read") {
    console.log(`[${new Date().toISOString()}] POST /read`);
    if (readBusy) {
      sendJson(res, 409, {
        ok: false,
        error: "Ya hay una lectura en curso. Espere a que termine y pulse una sola vez.",
        code: "BUSY",
      });
      return;
    }
    readBusy = true;
    try {
      const usbPort = await pickPort();
      const sample = usbPort ? await readOnce(35000) : await readFromEthernetMonitor(70000);
      console.log(
        `[read] OK SpO2=${sample.spo2} FC=${sample.hr} @ ${sample.port || sample.baudRate} bytes=${sample.bytes}`,
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
    } finally {
      readBusy = false;
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
