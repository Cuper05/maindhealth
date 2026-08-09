/**
 * MaindHealth — CONTEC CMS50D+ USB bridge
 *
 * Lee SpO2 / pulso por puerto serie USB y los envía a:
 *   POST /api/device-readings/ingest
 *
 * Uso:
 *   node bridge.mjs --list-ports
 *   node bridge.mjs --once
 *   node bridge.mjs --simulate --once
 *
 * Variables:
 *   MAINHEALTH_API_URL   (default https://health.maindsteel.com.mx)
 *   DEVICE_INGEST_API_KEY
 *   DEVICE_SERIAL        (default 22040300012)
 *   CMS50_PORT           (ej. COM4) — si no, auto-detecta
 *   PATIENT_ID           (opcional)
 *   APPOINTMENT_ID       (opcional)
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
  baud: Number(process.env.CMS50_BAUD || getArg("--baud") || 115200),
  stableNeeded: Number(process.env.CMS50_STABLE || 8),
};

function log(...parts) {
  console.log(new Date().toISOString(), ...parts);
}

async function listPorts() {
  const ports = await SerialPort.list();
  if (!ports.length) {
    log("No se encontraron puertos serie.");
    log("Conecta el CMS50D+, enciéndelo e instala el driver CP210x si hace falta.");
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
      blob.includes("usb serial") ||
      blob.includes("usb-serial")
    );
  });
  if (preferred) return preferred.path;
  // Evitar Intel AMT SOL
  const nonAmt = ports.find((p) => !`${p.friendlyName || ""}`.toLowerCase().includes("active management"));
  return nonAmt?.path || ports[0]?.path;
}

/**
 * Parser de tramas en vivo CMS50D+ (paquete de 5 bytes, bit7 sync en byte0).
 * SpO2 = byte4, PR = byte3 (valores típicos cuando hay dedo).
 */
function parseLivePackets(buffer) {
  const readings = [];
  for (let i = 0; i < buffer.length - 4; i++) {
    const b0 = buffer[i];
    if ((b0 & 0x80) === 0) continue;
    const b1 = buffer[i + 1];
    const b2 = buffer[i + 2];
    const b3 = buffer[i + 3];
    const b4 = buffer[i + 4];
    // bytes 1..4 suelen tener bit7 = 0 en protocolo clásico
    if (b1 & 0x80 || b2 & 0x80 || b3 & 0x80 || b4 & 0x80) continue;
    const pulseRate = b3;
    const spo2 = b4;
    if (spo2 >= 70 && spo2 <= 100 && pulseRate >= 30 && pulseRate <= 250) {
      readings.push({ oxygenSaturation: spo2, heartRate: pulseRate });
      i += 4;
    }
  }
  return readings;
}

/** Comando "start realtime" estilo protocolo v7 (best-effort). */
function realtimeStartCommands() {
  // Secuencias usadas por varias implementaciones CMS50* v7
  return [
    Buffer.from([0x7d, 0x81, 0xa1, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]),
    Buffer.from([0x7d, 0x81, 0xa7, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80]),
  ];
}

async function postReading(sample) {
  if (!config.apiKey) {
    throw new Error("Falta DEVICE_INGEST_API_KEY (env o Documents/maindhealth-device-ingest-key.txt)");
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
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${text}`);
  }
  return json;
}

function stableSample(window) {
  if (window.length < config.stableNeeded) return null;
  const recent = window.slice(-config.stableNeeded);
  const spo2 = recent.map((r) => r.oxygenSaturation);
  const hr = recent.map((r) => r.heartRate);
  const spo2Ok = Math.max(...spo2) - Math.min(...spo2) <= 2;
  const hrOk = Math.max(...hr) - Math.min(...hr) <= 8;
  if (!spo2Ok || !hrOk) return null;
  const avg = (arr) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  return {
    oxygenSaturation: avg(spo2),
    heartRate: avg(hr),
  };
}

async function readFromDevice() {
  const ports = await listPorts();
  const path = pickOximeterPort(ports);
  if (!path) {
    throw new Error(
      "No hay puerto COM del oxímetro. Conéctalo por USB, enciéndelo e instala driver CP210x.",
    );
  }
  log(`Abriendo ${path} @ ${config.baud} baud`);

  const port = new SerialPort({
    path,
    baudRate: config.baud,
    dataBits: 8,
    parity: "none",
    stopBits: 1,
    autoOpen: false,
  });

  await new Promise((resolve, reject) => {
    port.open((err) => (err ? reject(err) : resolve()));
  });

  for (const cmd of realtimeStartCommands()) {
    port.write(cmd);
  }

  const window = [];
  let buffer = Buffer.alloc(0);
  let sent = false;

  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      port.close(() => {});
      reject(
        new Error(
          "Timeout: no llegaron lecturas válidas. ¿Dedo en el oxímetro? ¿Driver/puerto correctos?",
        ),
      );
    }, 45000);

    port.on("data", async (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length > 4096) buffer = buffer.subarray(buffer.length - 2048);
      const readings = parseLivePackets(buffer);
      for (const r of readings) {
        window.push(r);
        if (window.length % 20 === 0) {
          log(`señal SpO2=${r.oxygenSaturation} FC=${r.heartRate} (muestras=${window.length})`);
        }
      }
      const stable = stableSample(window);
      if (stable && !sent) {
        sent = true;
        clearTimeout(timeout);
        try {
          log(`Lectura estable SpO2=${stable.oxygenSaturation}% FC=${stable.heartRate}`);
          const result = await postReading(stable);
          log("Enviado a MaindHealth:", JSON.stringify(result));
          port.close(() => resolve(stable));
        } catch (err) {
          port.close(() => reject(err));
        }
      }
    });

    port.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function main() {
  if (config.listPorts) {
    await listPorts();
    return;
  }

  if (config.simulate) {
    const sample = { oxygenSaturation: 98, heartRate: 72 };
    log("Modo simulate:", sample);
    const result = await postReading(sample);
    log("Enviado a MaindHealth:", JSON.stringify(result));
    return;
  }

  log("Iniciando puente CMS50D+ →", config.apiUrl);
  log("Serial equipo:", config.serialNumber);
  await readFromDevice();
  if (!config.once) {
    log("Lectura enviada. Vuelve a ejecutar para otra medición (kiosko spot-check).");
  }
}

main().catch((err) => {
  console.error("ERROR:", err.message || err);
  process.exit(1);
});
