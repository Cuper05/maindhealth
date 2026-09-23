/**
 * Monitor de signos vitales por Ethernet (familia Contec CMS / clones).
 * El aparato se conecta como cliente a 202.114.4.119:515-520 (CMS) y
 * 202.114.4.120:511 (HL7). Esta PC se hace pasar por esa central.
 *
 * HTTP kiosko: http://127.0.0.1:3932
 */
import http from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const HOST = "127.0.0.1";
const HTTP_PORT = Number(process.env.CMS_LAN_BRIDGE_PORT || 3932);
const CMS_PORTS = (process.env.CMS_LAN_PORTS || "511,515,516,517,518,519,520")
  .split(",")
  .map((n) => Number(n.trim()))
  .filter((n) => n > 0);
const LOG_DIR = path.join(process.env.LOCALAPPDATA || ".", "MaindHealth", "logs");
const SNIFF_LOG = path.join(LOG_DIR, "cms-lan-sniff.log");

/** @type {{
  spo2?: number;
  heartRate?: number;
  systolic?: number;
  diastolic?: number;
  mean?: number;
  temperature?: number;
  at: number;
  source: string;
  rawHint?: string;
}} */
let snapshot = {
  spo2: undefined,
  spo2At: 0,
  heartRate: undefined,
  heartRateAt: 0,
  systolic: undefined,
  systolicAt: 0,
  diastolic: undefined,
  diastolicAt: 0,
  mean: undefined,
  meanAt: 0,
  temperature: undefined,
  temperatureAt: 0,
  source: "none",
};
const clients = new Set();
let lastError = "";
/** @type {string[]} */
let alerts = [];
const sensorOff = { spo2: false, temp: false, ecg: false, resp: false, nibp: false };

function noteAlert(raw) {
  const text = String(raw || "")
    .replace(/\0/g, " ")
    .replace(/[^\x20-\x7e]/g, " ")
    .replace(/^[^\w]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 4) return;
  alerts = [text, ...alerts.filter((x) => x !== text)].slice(0, 8);
  const u = text.toUpperCase();
  const off = /\bOFF\b/.test(u);
  if (/SPO2/.test(u)) sensorOff.spo2 = off;
  if (/\bT1\b|\bT2\b|TEMP/.test(u)) sensorOff.temp = off;
  if (/\bECG\b/.test(u)) sensorOff.ecg = off;
  if (/\bRESP\b/.test(u)) sensorOff.resp = off;
  if (/\bNIBP\b|CUFF/.test(u)) sensorOff.nibp = off;
}

function ensureLogDir() {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}

function sniff(line, buf) {
  ensureLogDir();
  const cap = buf && buf.length > 800 ? 800 : buf?.length || 0;
  const hex = buf && buf.length ? buf.subarray(0, cap).toString("hex") : "";
  const ascii = buf && buf.length
    ? buf.subarray(0, Math.min(cap, 240)).toString("latin1").replace(/[^\x20-\x7e]/g, ".")
    : "";
  const row = `${new Date().toISOString()} ${line} hex=${hex} ascii=${ascii}\n`;
  try {
    fs.appendFileSync(SNIFF_LOG, row);
  } catch {
    /* ignore */
  }
  console.log(`[cms-lan] ${line}${ascii ? ` ${ascii.slice(0, 80)}` : ""}`);
}

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

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function plausibleSpo2(n) {
  return n != null && n >= 70 && n <= 100;
}
function plausibleHr(n) {
  return n != null && n >= 30 && n <= 220;
}
function plausibleSys(n) {
  return n != null && n >= 70 && n <= 250;
}
function plausibleDia(n) {
  return n != null && n >= 40 && n <= 150;
}
function plausibleTemp(n) {
  return n != null && n >= 34 && n <= 42;
}

function mergePatch(patch, source) {
  const now = Date.now();
  const next = { ...snapshot, source };
  if (plausibleSpo2(patch.spo2)) {
    next.spo2 = patch.spo2;
    next.spo2At = now;
  }
  if (plausibleHr(patch.heartRate)) {
    next.heartRate = patch.heartRate;
    next.heartRateAt = now;
  }
  if (plausibleSys(patch.systolic)) {
    next.systolic = patch.systolic;
    next.systolicAt = now;
  }
  if (plausibleDia(patch.diastolic)) {
    next.diastolic = patch.diastolic;
    next.diastolicAt = now;
  }
  if (patch.mean != null && patch.mean >= 50 && patch.mean <= 180) {
    next.mean = patch.mean;
    next.meanAt = now;
  }
  if (plausibleTemp(patch.temperature)) {
    next.temperature = patch.temperature;
    next.temperatureAt = now;
  }
  snapshot = next;
}

function idText(obx3) {
  return String(obx3 || "")
    .toUpperCase()
    .replace(/[^A-Z0-9_/]/g, " ");
}

function parseObxValue(obx) {
  const fields = obx.split("|");
  const id = idText(fields[3] || "");
  const raw = fields[5] || "";
  const unit = String(fields[6] || "").toLowerCase();
  if (!raw || raw === '""' || raw === '""' || raw === "---" || raw === "NA") return null;

  if (/NIBP/.test(id) && !/SYS|DIA|MEAN|MAP|_S|_D|_M/.test(id)) {
    const parts = raw.split(/[\/\\^]/).map((p) => num(p));
    return {
      systolic: parts[0],
      diastolic: parts[1] ?? parts[2],
      mean: parts.length >= 3 ? parts[2] : null,
    };
  }

  const value = num(String(raw).split("^")[0]);
  if (value == null) return null;

  if (/SPO2|O2 SAT|OXYGEN|150456/.test(id)) return { spo2: value };
  if (/\bPR\b|PULSE|HEART RATE|\bHR\b|0002-F082/.test(id) && !/RESP/.test(id)) {
    return { heartRate: value };
  }
  if (/NIBP.*S|SYS|_S\b|NS\b|SYSTOLIC/.test(id)) return { systolic: value };
  if (/NIBP.*D|DIA|_D\b|ND\b|DIASTOLIC/.test(id)) return { diastolic: value };
  if (/NIBP.*M|\bMAP\b|_M\b|MEAN|NM\b/.test(id)) return { mean: value };
  if (/\bT1\b|\bT2\b|TEMP|TEMPERATURE/.test(id) || unit.includes("cels") || unit === "c" || unit === "degc") {
    const t = value > 50 && value < 110 ? ((value - 32) * 5) / 9 : value;
    return { temperature: Number(t.toFixed(1)) };
  }
  return null;
}

function parseHl7(text) {
  const patch = {};
  const normalized = text.replace(/\r\n/g, "\r").replace(/\n/g, "\r");
  for (const line of normalized.split("\r")) {
    if (!line.startsWith("OBX|")) continue;
    const piece = parseObxValue(line);
    if (piece) Object.assign(patch, piece);
  }
  return patch;
}

function hl7Ack(message) {
  const msh = message.split(/\r/)[0] || "";
  const fields = msh.split("|");
  const msgid = fields[9] || String(Date.now());
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const ack = [
    `MSH|^~\\&|MAINHEALTH|STATION|${fields[2] || "CMS"}|${fields[3] || "MONITOR"}|${ts}||ACK^R01|${msgid}|P|2.4`,
    `MSA|AA|${msgid}`,
  ].join("\r");
  return Buffer.concat([Buffer.from([0x0b]), Buffer.from(ack, "latin1"), Buffer.from([0x1c, 0x0d])]);
}

function consumeMllp(buffer) {
  const out = [];
  let rest = buffer;
  while (rest.length) {
    const start = rest.indexOf(0x0b);
    if (start < 0) {
      const ascii = rest.toString("latin1");
      if (ascii.includes("MSH|")) {
        out.push(ascii.replace(/[\x00-\x08\x0e-\x1f]/g, "\r"));
        rest = Buffer.alloc(0);
      }
      break;
    }
    const end = rest.indexOf(0x1c, start + 1);
    if (end < 0) break;
    const msg = rest.subarray(start + 1, end).toString("latin1");
    out.push(msg);
    rest = rest.subarray(end + 1);
    if (rest[0] === 0x0d) rest = rest.subarray(1);
  }
  return { messages: out, rest };
}

function parseLooseAscii(text) {
  const patch = {};
  const spo2 = text.match(/SPO2\s*[:=]?\s*(\d{2,3})/i);
  const hr = text.match(/\b(?:PR|HR|PULSE)\s*[:=]?\s*(\d{2,3})/i);
  const sys = text.match(/\b(?:SYS|NS|NIBP_S)\s*[:=]?\s*(\d{2,3})/i);
  const dia = text.match(/\b(?:DIA|ND|NIBP_D)\s*[:=]?\s*(\d{2,3})/i);
  const temp = text.match(/\b(?:T1|TEMP)\s*[:=]?\s*(\d{2}(?:\.\d)?)/i);
  const nibp = text.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (spo2) patch.spo2 = num(spo2[1]);
  if (hr) patch.heartRate = num(hr[1]);
  if (sys) patch.systolic = num(sys[1]);
  if (dia) patch.diastolic = num(dia[1]);
  if (temp) patch.temperature = num(temp[1]);
  if (nibp && patch.systolic == null) {
    patch.systolic = num(nibp[1]);
    patch.diastolic = num(nibp[2]);
  }
  return patch;
}

const frameCounts = new Map();
/** @type {{ type: string, n: number, hex: string }[]} */
const lastFrames = [];

function f32ok(v, lo, hi) {
  return Number.isFinite(v) && v >= lo && v <= hi;
}

function waveNeighborhood(buf, i) {
  if (i < 2 || i + 3 >= buf.length) return false;
  let smooth = 0;
  for (let k = i - 2; k < i + 3; k++) {
    if (Math.abs(buf[k] - buf[k + 1]) <= 3) smooth += 1;
  }
  return smooth >= 3;
}

function extractSpo2Pr(buf, patch) {
  for (let i = 0; i < buf.length - 1; i++) {
    if (waveNeighborhood(buf, i)) continue;
    const a = buf[i];
    const b = buf[i + 1];
    if (plausibleSpo2(a) && plausibleHr(b) && b <= 140) {
      patch.spo2 = a;
      patch.heartRate = b;
      patch.rawHint = `spo2pr@${i}`;
      return true;
    }
  }
  return false;
}

function extractNibp(buf, patch) {
  const end = Math.min(buf.length, 96);
  for (let i = 0; i + 4 <= end; i += 2) {
    const sys = buf.readUInt16LE(i);
    const dia = buf.readUInt16LE(i + 2);
    if (!plausibleSys(sys) || !plausibleDia(dia) || sys < dia + 10) continue;
    patch.systolic = sys;
    patch.diastolic = dia;
    if (i + 6 <= end) {
      const mean = buf.readUInt16LE(i + 4);
      if (mean >= 50 && mean <= 180 && mean < sys && mean > dia) patch.mean = mean;
    }
    return true;
  }
  return false;
}

function noteFrame(type, payload) {
  const count = (frameCounts.get(type) || 0) + 1;
  frameCounts.set(type, count);
  const slice =
    type === 0x14 || type === 0x15
      ? payload.subarray(Math.max(0, payload.length - 40))
      : payload;
  const hex = slice.toString("hex");
  lastFrames.push({
    type: `0x${Number(type).toString(16)}`,
    n: payload.length,
    hex: hex.slice(0, 160),
  });
  if (lastFrames.length > 40) lastFrames.shift();
  const noisy = type === 0x14 || type === 0x15 || type === 0x17;
  if (noisy && count > 4 && count % 30 !== 0) return;
  if (count <= 20 || count % 20 === 0) {
    sniff(
      `frame 0x${Number(type).toString(16)} n=${payload.length} #${count}${type === 0x14 || type === 0x15 ? " tail" : ""}`,
      slice,
    );
  }
}

function applyCmsType(type, payload, patch) {
  noteFrame(type, payload);

  if (type === 0x17 && payload.length >= 4) {
    const t1 = payload.readFloatLE(0);
    if (f32ok(t1, 34, 42)) patch.temperature = Number(t1.toFixed(1));
    return;
  }

  if (type === 0x16 && payload.length >= 16) {
    // Cabecera 7 B + uint16 LE: SYS, DIA, MAP
    const sys = payload.readUInt16LE(7);
    const dia = payload.readUInt16LE(9);
    const mean = payload.readUInt16LE(11);
    if (plausibleSys(sys) && plausibleDia(dia) && sys > dia + 10) {
      patch.systolic = sys;
      patch.diastolic = dia;
      if (mean >= 50 && mean <= 180 && mean < sys && mean > dia) patch.mean = mean;
    }
    return;
  }

  if (type === 0x15) {
    // 256 muestras de pleth + uint16: SpO2, PR, límites… y a veces NIBP al final.
    if (payload.length >= 24) {
      const tail = payload.subarray(payload.length - 24);
      const spo2 = tail.readUInt16LE(0);
      const pr = tail.readUInt16LE(2);
      if (plausibleSpo2(spo2)) patch.spo2 = spo2;
      if (plausibleHr(pr)) patch.heartRate = pr;
      extractNibp(tail.subarray(16), patch);
    }
    return;
  }

  if (type === 0x14 && payload.length >= 24) {
    extractNibp(payload.subarray(payload.length - 24), patch);
    return;
  }

  if (payload.length >= 4 && payload.length < 400) {
    extractSpo2Pr(payload, patch);
    extractNibp(payload, patch);
  }
}

function applyOtherKind(kind, payload, patch) {
  noteFrame(0x1000 | kind, payload);
  if (kind === 0x49 || kind === 0x47) {
    noteAlert(payload.toString("latin1"));
  }
  if (payload.length >= 4) extractNibp(payload, patch);
}

function parseCmsBinary(buf) {
  const patch = {};
  let off = 0;
  while (off + 4 <= buf.length) {
    if (buf[off + 2] !== 0x05) {
      const hit = buf.indexOf(0x05, off + 1);
      if (hit < 2 || hit + 2 > buf.length) break;
      off = hit - 2;
      continue;
    }
    const len = buf.readUInt16LE(off);
    if (len < 2 || len > 8000) {
      off += 1;
      continue;
    }
    const total = len + 2;
    if (off + total > buf.length) break;
    const kind = buf[off + 3];
    if (kind === 0x46 && total >= 8 && buf[off + 4] === 0 && buf[off + 5] === 0) {
      const type = buf.readUInt16LE(off + 6);
      applyCmsType(type, buf.subarray(off + 8, off + total), patch);
    } else {
      applyOtherKind(kind, buf.subarray(off + 4, off + total), patch);
    }
    off += total;
  }
  return { patch, rest: buf.subarray(off) };
}

function attachClient(socket, label) {
  const remote = `${socket.remoteAddress}:${socket.remotePort}`;
  clients.add(socket);
  sniff(`connect ${label} ${remote}`, Buffer.alloc(0));
  lastError = "";
  let buf = Buffer.alloc(0);
  socket.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    if (buf.length > 1_000_000) buf = buf.subarray(-200_000);
    if (chunk.length < 900) sniff(`${label} ${remote} ${chunk.length}b`, chunk);
    const { patch, rest } = parseCmsBinary(buf);
    buf = rest;
    if (patch && Object.keys(patch).length) mergePatch(patch, "cms-bin");
    if (buf.length > 64_000) buf = buf.subarray(-8_000);
  });
  socket.on("error", (err) => {
    lastError = err.message;
    sniff(`error ${label} ${err.message}`, Buffer.alloc(0));
  });
  socket.on("close", () => {
    clients.delete(socket);
    sniff(`close ${label} ${remote}`, Buffer.alloc(0));
  });
}

function latestAt() {
  return Math.max(
    snapshot.spo2At || 0,
    snapshot.heartRateAt || 0,
    snapshot.systolicAt || 0,
    snapshot.diastolicAt || 0,
    snapshot.temperatureAt || 0,
  );
}

function publicSnapshot() {
  const at = latestAt();
  const ageMs = at ? Date.now() - at : null;
  return {
    ok: true,
    connected: clients.size > 0,
    clients: clients.size,
    ageMs,
    spo2: snapshot.spo2 ?? null,
    heartRate: snapshot.heartRate ?? null,
    systolicPressure: snapshot.systolic ?? null,
    diastolicPressure: snapshot.diastolic ?? null,
    meanPressure: snapshot.mean ?? null,
    temperature: snapshot.temperature ?? null,
    source: snapshot.source,
    lastError: lastError || null,
    alerts,
    sensorOff: { ...sensorOff },
    ifaces: os.networkInterfaces()["Ethernet"]?.map((x) => x.address) ?? [],
  };
}

function waitFor(kind, timeoutMs, onTick) {
  const need = {
    spo2: () => plausibleSpo2(snapshot.spo2) && Date.now() - snapshot.spo2At < 120000,
    nibp: () =>
      plausibleSys(snapshot.systolic) &&
      plausibleDia(snapshot.diastolic) &&
      snapshot.systolic > snapshot.diastolic &&
      Date.now() - snapshot.systolicAt < 600000 &&
      Date.now() - snapshot.diastolicAt < 600000,
    temp: () => plausibleTemp(snapshot.temperature) && Date.now() - snapshot.temperatureAt < 120000,
  }[kind];
  if (!need) return Promise.reject(new Error("kind inválido"));

  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (need()) {
        clearInterval(iv);
        resolve(publicSnapshot());
        return;
      }
      const elapsed = Date.now() - started;
      if (elapsed >= timeoutMs) {
        clearInterval(iv);
        reject(
          Object.assign(
            new Error(timeoutMessage(kind)),
            { code: "TIMEOUT" },
          ),
        );
        return;
      }
      onTick?.(elapsed);
    };
    const iv = setInterval(tick, 400);
    tick();
  });
}

function timeoutMessage(kind) {
  if (clients.size === 0) {
    return "El monitor no se ha conectado por Ethernet. En la PC, Ethernet debe tener 202.114.4.119 (ejecute 1-configurar-ethernet.bat como administrador). En el monitor: NET TYPE = CMS, o CUSTOM con SERVER IP = 202.114.4.119.";
  }
  if (kind === "nibp") {
    return "Hay enlace, pero no llegó presión. Ponga el brazalete y pulse NIBP / Start en el monitor.";
  }
  if (kind === "spo2") {
    if (sensorOff.spo2) {
      return "El monitor avisa SPO2 SENSOR OFF. Coloque el clip de SpO₂ en el dedo y espere números en pantalla.";
    }
    return "Hay enlace, pero no llegó SpO₂. Coloque el sensor de dedo del monitor y espere números en pantalla.";
  }
  if (sensorOff.temp) {
    return "El monitor avisa T1/T2 SENSOR OFF. Coloque la sonda de temperatura en la axila.";
  }
  return "Hay enlace, pero no llegó temperatura. Coloque la sonda de temperatura del monitor.";
}

const progress = { message: "Esperando al monitor…" };

for (const port of CMS_PORTS) {
  const srv = net.createServer((socket) => attachClient(socket, `tcp/${port}`));
  srv.on("error", (err) => {
    lastError = `bind ${port}: ${err.message}`;
    console.error(lastError);
  });
  srv.listen(port, "0.0.0.0", () => {
    console.log(`[cms-lan] listen 0.0.0.0:${port}`);
  });
}

const httpServer = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }
  const url = new URL(req.url || "/", `http://${HOST}:${HTTP_PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, {
      ...publicSnapshot(),
      device: "cms-lan-monitor",
      ports: CMS_PORTS,
      message: progress.message,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/snapshot") {
    sendJson(res, 200, publicSnapshot());
    return;
  }

  if (req.method === "GET" && url.pathname === "/frames") {
    sendJson(res, 200, {
      ok: true,
      connected: clients.size > 0,
      counts: Object.fromEntries([...frameCounts.entries()].map(([k, v]) => [`0x${Number(k).toString(16)}`, v])),
      frames: lastFrames.slice(-20),
      snapshot: publicSnapshot(),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/progress") {
    sendJson(res, 200, { message: progress.message, ...publicSnapshot() });
    return;
  }

  if (req.method === "POST" && url.pathname === "/read") {
    const kind = (url.searchParams.get("kind") || "any").toLowerCase();
    const mapped = kind === "oxygen" ? "spo2" : kind === "bp" || kind === "pressure" ? "nibp" : kind;
    const timeouts = { spo2: 70000, nibp: 150000, temp: 90000, any: 150000 };
    const timeoutMs = timeouts[mapped] || 90000;
    progress.message =
      mapped === "nibp"
        ? "Enlace Ethernet. Brazalete puesto: pulse NIBP en el monitor."
        : mapped === "spo2"
          ? "Enlace Ethernet. Dedo en el sensor de SpO₂ del monitor."
          : mapped === "temp"
            ? "Enlace Ethernet. Sonda de temperatura en la axila."
            : "Esperando signos del monitor…";
    try {
      if (mapped === "any") {
        const sample = await waitFor(
          snapshot.systolic ? "nibp" : snapshot.spo2 ? "spo2" : "temp",
          timeoutMs,
          () => {},
        );
        sendJson(res, 200, { ok: true, ...sample });
        return;
      }
      const sample = await waitFor(mapped, timeoutMs, () => {});
      progress.message = "Lectura recibida";
      sendJson(res, 200, { ok: true, ...sample });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      progress.message = message;
      sendJson(res, 500, { ok: false, error: message, ...publicSnapshot() });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
});

httpServer.listen(HTTP_PORT, HOST, () => {
  console.log(`[cms-lan-bridge] http://${HOST}:${HTTP_PORT}`);
  console.log(`[cms-lan-bridge] CMS/HL7 TCP ${CMS_PORTS.join(",")}`);
  console.log(`[cms-lan-bridge] log ${SNIFF_LOG}`);
});
