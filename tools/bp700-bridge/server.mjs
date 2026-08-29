/**
 * Bridge baumanómetro USB (Silicon Labs CP2110, serie TU0-700X).
 * El aparato NO mide con el USB conectado (entra en modo PC). Flujo:
 * desconectar → medir → reconectar → leer el resultado guardado.
 * http://127.0.0.1:3931
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import HID from "node-hid";

const execFileAsync = promisify(execFile);

const HOST = "127.0.0.1";
const PORT = Number(process.env.BP_BRIDGE_PORT || 3931);
const VID = 0x10c4;
const PID = 0xea80;
const SERIAL = (process.env.BP_SERIAL || "TU0-700X").toUpperCase();
const BAUDS = (process.env.BP_BAUDS || "115200,9600,38400,4800")
  .split(",")
  .map((n) => Number(n.trim()))
  .filter((n) => n > 0);
const READ_TIMEOUT_MS = Number(process.env.BP_READ_TIMEOUT_MS || 150000);
const LOG_DIR = path.join(process.env.LOCALAPPDATA || ".", "MaindHealth", "logs");
const SNIFF_LOG = path.join(LOG_DIR, "presion-sniff.log");

let progress = {
  phase: "idle",
  message: "Listo",
  plugged: false,
};
let readingLock = false;
let patientDone = false;

function setProgress(phase, message) {
  progress = { phase, message, plugged: Boolean(findDevice()) };
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(payload);
}

function listCp2110() {
  return HID.devices().filter(
    (d) => d.vendorId === VID && d.productId === PID && d.path,
  );
}

function findDevice() {
  const all = listCp2110();
  if (!all.length) return null;
  return (
    all.find((d) => (d.serialNumber || "").toUpperCase().includes(SERIAL)) ||
    all[0]
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gateScriptPath() {
  return path.join(process.cwd(), "usb-gate.ps1");
}

async function waitUntil(pred, ms, stepMs = 350) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (pred()) return true;
    await sleep(stepMs);
  }
  return pred();
}

async function runSchtask(name) {
  await execFileAsync("schtasks.exe", ["/Run", "/TN", name], {
    windowsHide: true,
    timeout: 20000,
  });
}

async function runGateScript(action) {
  await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      gateScriptPath(),
      "-Action",
      action,
      "-Target",
      "bp",
    ],
    { windowsHide: true, timeout: 25000 },
  );
}

async function usbGate(action) {
  const wantPresent = action === "enable";
  try {
    await runSchtask(action === "disable" ? "MaindHealthBpUsbDisable" : "MaindHealthBpUsbEnable");
  } catch {
    try {
      await runGateScript(action);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `No se pudo ${action === "disable" ? "liberar" : "reactivar"} el USB (${detail}). Ejecute una sola vez tools\\bp700-bridge\\1-instalar-permiso-usb.bat (permiso de Windows, no se desconecta el cable).`,
      );
    }
  }
  const ok = await waitUntil(() => Boolean(findDevice()) === wantPresent, 10000);
  if (!ok && action === "disable" && findDevice()) {
    throw new Error(
      "Windows no soltó el USB. Ejecute una sola vez tools\\bp700-bridge\\1-instalar-permiso-usb.bat y vuelva a intentar. El cable se queda puesto.",
    );
  }
}

function featureReport(bytes) {
  const buf = Buffer.alloc(64, 0);
  Buffer.from(bytes).copy(buf);
  return [...buf];
}

function configureUart(dev, baud) {
  const baudBe = Buffer.alloc(4);
  baudBe.writeUInt32BE(baud, 0);
  dev.sendFeatureReport(
    featureReport([0x50, ...baudBe, 0x00, 0x00, 0x03, 0x00]),
  );
  dev.sendFeatureReport(featureReport([0x43, 0x03]));
  dev.sendFeatureReport(featureReport([0x41, 0x01]));
}

function uartWrite(dev, payload) {
  const id = Math.min(payload.length, 0x3f);
  const report = Buffer.alloc(64, 0);
  report[0] = id;
  payload.subarray(0, id).copy(report, 1);
  dev.write([...report]);
}

function plausible(sys, dia, hr) {
  if (!(sys >= 80 && sys <= 230 && dia >= 40 && dia <= 140 && sys >= dia + 10)) {
    return false;
  }
  if (hr == null || hr === 0) return true;
  return hr >= 40 && hr <= 180;
}

function parseReading(buffer) {
  if (!buffer?.length) return null;
  const ascii = buffer.toString("latin1");
  const slash = ascii.match(/(\d{2,3})\s*\/\s*(\d{2,3})(?:[^\d]{1,8}(\d{2,3}))?/);
  if (slash) {
    const sys = Number(slash[1]);
    const dia = Number(slash[2]);
    const hr = Number(slash[3] || 0);
    if (plausible(sys, dia, hr || 70)) {
      return { sys, dia, hr: hr || null, format: "ascii" };
    }
  }
  const labeled = ascii.match(
    /SYS[:\s]*(\d{2,3}).{0,12}DIA[:\s]*(\d{2,3}).{0,12}(?:PUL|HR|PR)[:\s]*(\d{2,3})/i,
  );
  if (labeled) {
    const sys = Number(labeled[1]);
    const dia = Number(labeled[2]);
    const hr = Number(labeled[3]);
    if (plausible(sys, dia, hr)) return { sys, dia, hr, format: "labeled" };
  }

  for (let i = 0; i < buffer.length - 5; i++) {
    const a = buffer[i];
    const b = buffer[i + 1];
    if ((a === 0x55 && b === 0xaa) || (a === 0xaa && b === 0x55)) {
      for (const off of [2, 3, 4]) {
        const sys = buffer[i + off];
        const dia = buffer[i + off + 1];
        const hr = buffer[i + off + 2];
        if (plausible(sys, dia, hr)) {
          return { sys, dia, hr, format: "hdr" };
        }
      }
    }
  }

  for (let i = 0; i < buffer.length - 2; i++) {
    const sys = buffer[i];
    const dia = buffer[i + 1];
    const hr = buffer[i + 2];
    if (plausible(sys, dia, hr) && hr >= 40) {
      return { sys, dia, hr, format: "u8" };
    }
  }

  for (let i = 0; i + 5 < buffer.length; i++) {
    const sys = buffer.readUInt16LE(i);
    const dia = buffer.readUInt16LE(i + 2);
    const hr = buffer.readUInt16LE(i + 4);
    if (plausible(sys, dia, hr) && hr >= 40) {
      return { sys, dia, hr, format: "u16le" };
    }
  }
  return null;
}

function sendProbes(dev) {
  const probes = [
    Buffer.from([0xaa, 0x55]),
    Buffer.from([0x55, 0xaa]),
    Buffer.from([0xa5, 0x5a]),
    Buffer.from([0xfd, 0xfd]),
    Buffer.from([0xbe, 0x20, 0x00, 0x00]),
    Buffer.from([0x01, 0x00]),
    Buffer.from("AT\r\n", "ascii"),
    Buffer.from("READ\r\n", "ascii"),
    Buffer.from("M\r", "ascii"),
  ];
  for (const probe of probes) {
    try {
      uartWrite(dev, probe);
    } catch {
      /* ignore */
    }
  }
}

function appendSniff(note, buf) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const hex = buf?.length ? buf.toString("hex") : "";
    fs.appendFileSync(
      SNIFF_LOG,
      `${new Date().toISOString()} ${note} len=${buf?.length || 0} ${hex}\n`,
    );
  } catch {
    /* ignore */
  }
}

function dumpAfterConnect(timeoutMs) {
  return new Promise((resolve, reject) => {
    const info = findDevice();
    if (!info) {
      reject(new Error("USB reconectado pero el baumanómetro no aparece aún. Espere 2 s y toque Leer otra vez."));
      return;
    }

    let dev;
    try {
      dev = new HID.HID(info.path);
    } catch (err) {
      reject(
        new Error(
          `No se pudo abrir el baumanómetro USB: ${err instanceof Error ? err.message : String(err)}`,
        ),
      );
      return;
    }

    const chunks = [];
    let settled = false;
    let baudIndex = 0;
    let phaseTimer;

    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      clearTimeout(phaseTimer);
      try {
        dev.removeAllListeners();
        dev.close();
      } catch {
        /* ignore */
      }
      if (err) reject(err);
      else resolve(value);
    };

    const consider = () => {
      const buf = Buffer.concat(chunks);
      const parsed = parseReading(buf);
      if (parsed?.sys && parsed?.dia) {
        appendSniff(`ok ${parsed.format}`, buf);
        finish(null, { ...parsed, bytes: buf.length });
      }
    };

    dev.on("error", (err) => finish(err));
    dev.on("data", (data) => {
      const buf = Buffer.from(data);
      if (!buf.length) return;
      const n = buf[0];
      if (n >= 1 && n <= 0x3f) chunks.push(buf.subarray(1, 1 + n));
      else chunks.push(buf);
      consider();
    });

    const runBaud = () => {
      if (settled) return;
      if (baudIndex >= BAUDS.length) {
        const buf = Buffer.concat(chunks);
        appendSniff("fail", buf);
        finish(
          new Error(
            `USB listo pero no llegó la medición (${buf.length} bytes). Pulse el botón del aparato, espere el resultado y toque Ya vi el resultado.`,
          ),
        );
        return;
      }
      const baud = BAUDS[baudIndex];
      baudIndex += 1;
      setProgress("dump", `USB detectado. Leyendo a ${baud} baudios…`);
      try {
        configureUart(dev, baud);
      } catch (err) {
        finish(err);
        return;
      }
      phaseTimer = setTimeout(() => {
        if (settled) return;
        sendProbes(dev);
        phaseTimer = setTimeout(runBaud, 2500);
      }, 3000);
    };

    runBaud();

    const hardTimer = setTimeout(() => {
      const buf = Buffer.concat(chunks);
      const parsed = parseReading(buf);
      if (parsed?.sys && parsed?.dia) {
        appendSniff(`ok-timeout ${parsed.format}`, buf);
        finish(null, { ...parsed, bytes: buf.length });
        return;
      }
      appendSniff("timeout", buf);
      finish(
        new Error(
          `Sin lectura de presión (${buf.length} bytes). Pulse inicio en el aparato, espere el número y toque Ya vi el resultado.`,
        ),
      );
    }, timeoutMs);
  });
}

async function waitForPatientDone(deadline) {
  setProgress(
    "measure",
    "Cable puesto. Coloque el brazalete, pulse inicio en el aparato y, al ver el número, toque Ya vi el resultado.",
  );
  while (Date.now() < deadline) {
    if (patientDone) {
      patientDone = false;
      return;
    }
    await sleep(250);
  }
}

async function readSession() {
  const deadline = Date.now() + READ_TIMEOUT_MS;
  patientDone = false;
  let released = false;
  setProgress("unplug", "Liberando el USB en la PC. El cable se queda puesto…");
  await usbGate("disable");
  released = true;
  try {
    await waitForPatientDone(deadline);
    setProgress("dump", "Reactivando USB y leyendo la medición…");
    await usbGate("enable");
    released = false;
    await sleep(1500);
    const remaining = Math.max(8000, deadline - Date.now());
    return await dumpAfterConnect(Math.min(remaining, 28000));
  } finally {
    if (released) {
      try {
        await usbGate("enable");
      } catch {
        /* ignore */
      }
    }
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    const info = findDevice();
    sendJson(res, 200, {
      ok: true,
      device: "bp-cp2110",
      serial: info?.serialNumber || null,
      plugged: Boolean(info),
      hidDevices: listCp2110().length,
      phase: progress.phase,
      message: progress.message,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/progress") {
    sendJson(res, 200, {
      ok: true,
      ...progress,
      plugged: Boolean(findDevice()),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/read") {
    let body = {};
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      if (chunks.length) body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      body = {};
    }
    const simulate =
      url.searchParams.get("simulate") === "1" || body.simulate === true;
    if (simulate) {
      sendJson(res, 200, {
        ok: true,
        systolicPressure: 118,
        diastolicPressure: 76,
        heartRate: 72,
        simulated: true,
      });
      return;
    }

    if (readingLock) {
      sendJson(res, 409, {
        ok: false,
        error: "Ya hay una lectura de presión en curso.",
      });
      return;
    }

    readingLock = true;
    try {
      const reading = await readSession();
      setProgress("idle", "Listo");
      sendJson(res, 200, {
        ok: true,
        systolicPressure: reading.sys,
        diastolicPressure: reading.dia,
        heartRate: reading.hr,
        format: reading.format,
        bytes: reading.bytes,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setProgress("idle", message);
      sendJson(res, 503, { ok: false, error: message });
    } finally {
      readingLock = false;
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/continue") {
    patientDone = true;
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`[bp700-bridge] http://${HOST}:${PORT} (USB silenciado por software, cable puesto)`);
});
