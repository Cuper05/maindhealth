/**
 * MaindHealth — CONTEC CMS50D+ USB bridge
 *
 * Lee SpO2 / pulso por puerto serie USB y los envía a:
 *   POST /api/device-readings/ingest
 */

import { SerialPort } from "serialport";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const getArg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

function loadKeyFromDocuments() {
  const keyFile = resolve(
    process.env.USERPROFILE || "",
    "Documents",
    "maindhealth-device-ingest-key.txt",
  );
  if (!existsSync(keyFile)) return null;
  const text = readFileSync(keyFile, "utf8");
  const match = text.match(/DEVICE_INGEST_API_KEY=([^\r\n]+)/);
  return match?.[1]?.trim() || null;
}

const config = {
  apiUrl: (process.env.MAINHEALTH_API_URL || "https://health.maindsteel.com.mx").replace(/\/$/, ""),
  apiKey: process.env.DEVICE_INGEST_API_KEY || loadKeyFromDocuments(),
  serialNumber: process.env.DEVICE_SERIAL || getArg("--serial") || "22040300012",
  portPath: process.env.CMS50_PORT || getArg("--port"),
  patientId: process.env.PATIENT_ID || getArg("--patient"),
  appointmentId: process.env.APPOINTMENT_ID || getArg("--appointment"),
  once: args.has("--once"),
  simulate: args.has("--simulate"),
  listPorts: args.has("--list-ports"),
  debug: args.has("--debug"),
  baud: Number(process.env.CMS50_BAUD || getArg("--baud") || 19200),
  stableNeeded: Number(process.env.CMS50_STABLE || 5),
};

function log(...parts) {
  console.log(new Date().toISOString(), ...parts);
}

async function listPorts() {
  const ports = await SerialPort.list();
  if (!ports.length) {
    log("No se encontraron puertos serie.");
    return ports;
  }
  for (const p of ports) {
    console.log(
      `${p.path}\t${p.friendlyName || p.manufacturer || ""}\t${p.vendorId || ""}:${p.productId || ""}`,
    );
  }
  return ports;
}

function pickOximeterPort(ports) {
  if (config.portPath) return config.portPath;
  const preferred = ports.find((p) => {
    const blob = `${p.friendlyName || ""} ${p.manufacturer || ""} ${p.path}`.toLowerCase();
    return (
      blob.includes("cp210") ||
      blob.includes("silicon") ||
      blob.includes("contec") ||
      blob.includes("usb serial")
    );
  });
  if (preferred) return preferred.path;
  const nonAmt = ports.find(
    (p) => !`${p.friendlyName || ""}`.toLowerCase().includes("active management"),
  );
  return nonAmt?.path || ports[0]?.path;
}

/** Paquetes clásicos de 5 bytes (bit7 sync). */
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
    const pulseRate = b3;
    const spo2 = b4;
    if (spo2 >= 70 && spo2 <= 100 && pulseRate >= 30 && pulseRate <= 250) {
      readings.push({ oxygenSaturation: spo2, heartRate: pulseRate, format: "classic5" });
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
    if (buffer[i] !== 0x01) continue;
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
      readings.push({ oxygenSaturation: spo2, heartRate: hr, format: "v7" });
    }
  }
  return readings;
}

/**
 * Fallback: busca pares SpO2/HR razonables cerca de cabecera 0x01.
 */
function parseLoose(buffer) {
  const readings = [];
  for (let i = 0; i < buffer.length - 8; i++) {
    if (buffer[i] !== 0x01 && buffer[i] !== 0x81) continue;
    for (let a = i + 1; a < i + 8 && a < buffer.length; a++) {
      for (let b = a + 1; b < i + 9 && b < buffer.length; b++) {
        const spo2 = buffer[a];
        const hr = buffer[b];
        if (spo2 >= 85 && spo2 <= 100 && hr >= 40 && hr <= 180) {
          readings.push({ oxygenSaturation: spo2, heartRate: hr, format: "loose" });
        }
      }
    }
  }
  return readings;
}

function realtimeCommands() {
  return [
    // stop store / stop real / request device / start real (variantes v7)
    Buffer.from([0x7d, 0x81, 0xa6, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]),
    Buffer.from([0x7d, 0x81, 0xa2, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]),
    Buffer.from([0x7d, 0x81, 0xa7, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]),
    Buffer.from([0x7d, 0x81, 0xa1, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]),
    Buffer.from([0x7d, 0x81, 0xa0, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]),
  ];
}

async function postReading(sample) {
  if (!config.apiKey) {
    throw new Error("Falta DEVICE_INGEST_API_KEY");
  }
  const body = {
    serialNumber: config.serialNumber,
    oxygenSaturation: String(sample.oxygenSaturation),
    heartRate: String(sample.heartRate),
    syncToVitals: Boolean(config.patientId),
  };
  if (config.patientId) body.patientId = Number(config.patientId);
  if (config.appointmentId) body.appointmentId = Number(config.appointmentId);

  const res = await fetch(`${config.apiUrl}/api/device-readings/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`API ${res.status}: ${text}`);
  return JSON.parse(text);
}

function stableSample(window) {
  if (window.length < config.stableNeeded) return null;
  const recent = window.slice(-config.stableNeeded);
  const spo2 = recent.map((r) => r.oxygenSaturation);
  const hr = recent.map((r) => r.heartRate);
  if (Math.max(...spo2) - Math.min(...spo2) > 2) return null;
  if (Math.max(...hr) - Math.min(...hr) > 10) return null;
  const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  return { oxygenSaturation: avg(spo2), heartRate: avg(hr) };
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

async function tryBaud(path, baudRate) {
  log(`Probando ${path} @ ${baudRate} baud (ponte el dedo ahora)`);
  const port = await openPort(path, baudRate);
  let buffer = Buffer.alloc(0);
  const window = [];
  let bytes = 0;

  await setSignals(port, false, false);
  await new Promise((r) => setTimeout(r, 80));
  await setSignals(port, true, false);
  await new Promise((r) => setTimeout(r, 120));

  for (const cmd of realtimeCommands()) {
    port.write(cmd);
    await new Promise((r) => setTimeout(r, 50));
  }

  // Reenviar start realtime + keepalive periódicamente
  const ping = setInterval(() => {
    port.write(Buffer.from([0x7d, 0x81, 0xa1, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]));
    port.write(Buffer.from([0x7d, 0x81, 0xaf, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]));
  }, 700);

  return await new Promise((resolve) => {
    const done = (result) => {
      clearInterval(ping);
      clearTimeout(timer);
      port.removeAllListeners("data");
      port.close(() => resolve(result));
    };

    const timer = setTimeout(() => {
      if (config.debug) {
        log(`Debug ${baudRate}: bytes=${bytes} tail=${buffer.subarray(Math.max(0, buffer.length - 40)).toString("hex")}`);
      }
      done({ ok: false, baudRate, bytes, window: window.length });
    }, 20000);

    port.on("data", (chunk) => {
      bytes += chunk.length;
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > 8192) buffer = buffer.subarray(buffer.length - 4096);
      if (config.debug && bytes <= chunk.length + 5) {
        log(`RX ${baudRate}:`, chunk.subarray(0, 64).toString("hex"));
      }
      const readings = [...parseClassic5(buffer), ...parseV7(buffer), ...parseLoose(buffer)];
      for (const r of readings) {
        window.push(r);
        if (window.length === 1 || window.length % 10 === 0) {
          log(`señal SpO2=${r.oxygenSaturation} FC=${r.heartRate} (${r.format})`);
        }
      }
      const stable = stableSample(window);
      if (stable) done({ ok: true, sample: stable, baudRate });
    });

    port.on("error", (err) => {
      log("Puerto error:", err.message);
      done({ ok: false, baudRate, error: err.message, bytes });
    });
  });
}

async function readFromDevice() {
  const ports = await listPorts();
  const path = pickOximeterPort(ports);
  if (!path) {
    throw new Error("No hay COM del oxímetro. ¿Driver CP210x y aparato encendido?");
  }

  const bauds = config.baud
    ? [config.baud, ...[19200, 115200].filter((b) => b !== config.baud)]
    : [19200, 115200];
  for (const baud of bauds) {
    const result = await tryBaud(path, baud);
    if (result.ok) {
      log(`Lectura estable @ ${result.baudRate}: SpO2=${result.sample.oxygenSaturation}% FC=${result.sample.heartRate}`);
      const api = await postReading(result.sample);
      log("Enviado a MaindHealth:", JSON.stringify(api));
      return result.sample;
    }
    log(`Sin lectura válida @ ${baud} (bytes=${result.bytes || 0})`);
  }
  throw new Error(
    "No se obtuvieron lecturas. Confirma: oxímetro encendido, dedo colocado, cable USB bien puesto.",
  );
}

async function main() {
  if (config.listPorts) {
    await listPorts();
    return;
  }
  if (config.simulate) {
    const sample = { oxygenSaturation: 98, heartRate: 72 };
    log("Modo simulate:", sample);
    log("Enviado a MaindHealth:", JSON.stringify(await postReading(sample)));
    return;
  }
  log("Iniciando puente CMS50D+ →", config.apiUrl);
  log("Serial equipo:", config.serialNumber);
  await readFromDevice();
}

main().catch((err) => {
  console.error("ERROR:", err.message || err);
  process.exit(1);
});
