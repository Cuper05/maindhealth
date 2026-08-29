/**
 * Bridge ECG Lepu/Creative PC-80B (Easy ECG Monitor).
 * Disco USB "EASY ECG" con .SCP. El cable se queda puesto: la PC silencia el USB,
 * el paciente mide, luego se reactiva y se lee el registro nuevo.
 * http://127.0.0.1:3928
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const HOST = "127.0.0.1";
const PORT = Number(process.env.ECG_BRIDGE_PORT || 3928);
const READ_TIMEOUT_MS = Number(process.env.ECG_READ_TIMEOUT_MS || 150000);

const RESULT_LABELS = [
  "Sin irregularidad",
  "Sospecha de latido un poco rápido",
  "Sospecha de latido rápido",
  "Sospecha de taquicardia en ráfaga",
  "Sospecha de latido un poco lento",
  "Sospecha de latido lento",
  "Sospecha de intervalo corto ocasional",
  "Sospecha de intervalo irregular",
  "Sospecha de latido rápido con intervalo corto",
  "Sospecha de latido lento con intervalo corto",
  "Sospecha de latido lento con intervalo irregular",
  "Línea de base inestable",
  "Sospecha de latido rápido con línea de base inestable",
  "Sospecha de latido lento con línea de base inestable",
  "Sospecha de intervalo corto ocasional con línea de base inestable",
  "Sospecha de intervalo irregular con línea de base inestable",
  "Señal pobre, medir de nuevo",
];

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

function findEasyEcgRoot() {
  const envRoot = process.env.ECG_DISK_ROOT;
  if (envRoot && fs.existsSync(envRoot)) return envRoot;

  try {
    const letter = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "(Get-Volume | Where-Object { $_.FileSystemLabel -match 'EASY ECG' }).DriveLetter",
      ],
      { encoding: "utf8", timeout: 8000 },
    )
      .trim()
      .replace(/[^A-Za-z]/g, "");
    if (letter) {
      const root = `${letter}:\\`;
      if (fs.existsSync(root)) return root;
    }
  } catch {
    /* ignore */
  }

  for (const letter of "DEFGHIJKLMNOPQRSTUVWXYZ") {
    const root = `${letter}:\\`;
    try {
      if (
        fs.existsSync(path.join(root, "README.TXT")) &&
        (fs.existsSync(path.join(root, "ECG0")) ||
          fs.existsSync(path.join(root, "ECG_0")))
      ) {
        return root;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function listScpFiles(root) {
  if (!root) return [];
  const dirs = ["ECG0", "ECG1", "ECG2", "ECG3", "ECG_0", "ECG_1", "ECG_2", "ECG_3"];
  const files = [];
  for (const dir of dirs) {
    const full = path.join(root, dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full)) {
      if (!/\.scp$/i.test(name)) continue;
      const filePath = path.join(full, name);
      const st = fs.statSync(filePath);
      files.push({ filePath, mtimeMs: st.mtimeMs, size: st.size });
    }
  }
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files;
}

function readU16(buf, offset) {
  return buf.readUInt16LE(offset);
}

function readU32(buf, offset) {
  return buf.readUInt32LE(offset);
}

function estimateHrFromSamples(samples, hz) {
  if (samples.length < hz) return null;
  const mean =
    samples.reduce((sum, v) => sum + v, 0) / samples.length;
  const threshold = mean + 180;
  const minGap = Math.floor(hz * 0.35);
  const peaks = [];
  for (let i = 1; i < samples.length - 1; i++) {
    if (
      samples[i] > threshold &&
      samples[i] >= samples[i - 1] &&
      samples[i] >= samples[i + 1]
    ) {
      if (!peaks.length || i - peaks[peaks.length - 1] >= minGap) {
        peaks.push(i);
      }
    }
  }
  if (peaks.length < 2) return null;
  const durationSec = (peaks[peaks.length - 1] - peaks[0]) / hz;
  if (durationSec < 1) return null;
  const hr = Math.round(((peaks.length - 1) / durationSec) * 60);
  if (hr < 30 || hr > 220) return null;
  return hr;
}

function mapRhythmFromHr(hr, text) {
  const raw = (text || "").trim();
  if (/poor signal|señal pobre|measure again/i.test(raw)) {
    return "Señal pobre, medir de nuevo";
  }
  if (raw && raw.length > 3 && raw.length < 180) return raw;
  if (hr == null) return "ECG registrado";
  if (hr < 50) return "Sospecha de latido lento";
  if (hr < 60) return "Sospecha de latido un poco lento";
  if (hr > 140) return "Sospecha de latido rápido";
  if (hr > 100) return "Sospecha de latido un poco rápido";
  return "Sin irregularidad aparente";
}

function parseScp(buf) {
  if (buf.length < 16) return null;
  const recLen = readU32(buf, 2);
  const end = Math.min(buf.length, recLen || buf.length);
  let offset = 6;
  let hr = null;
  let statements = [];
  let samples = [];
  let intervalUs = 6667;

  while (offset + 8 <= end) {
    const secId = readU16(buf, offset + 2);
    const secLen = readU32(buf, offset + 4);
    if (secLen < 8 || offset + secLen > buf.length) break;
    const payload = buf.subarray(offset + 16, offset + secLen);

    if (secId === 1) {
      let p = 0;
      while (p + 3 <= payload.length) {
        const tag = payload[p];
        if (tag === 255) break;
        const vlen = payload.readUInt16LE(p + 1);
        const data = payload.subarray(p + 3, p + 3 + vlen);
        if (tag === 14 || tag === 15) {
          const txt = data.toString("latin1").replace(/\0/g, " ").trim();
          if (txt) statements.push(txt);
        }
        p += vlen + 3;
      }
    }

    if (secId === 7 && payload.length >= 2) {
      const rr = payload.readUInt16LE(0);
      if (rr >= 300 && rr <= 2000) hr = Math.round(60000 / rr);
      if (payload.length >= 18) {
        const hrField = payload.readUInt16LE(16);
        if (hrField >= 30 && hrField <= 220) hr = hrField;
      }
    }

    if (secId === 8) {
      const txt = payload.toString("latin1").replace(/[\0\r]+/g, " ").trim();
      if (txt) statements.push(txt);
    }

    if (secId === 6 && payload.length >= 8) {
      intervalUs = payload.readUInt16LE(2) || intervalUs;
      const dataLen = payload.readUInt16LE(6);
      const data = payload.subarray(8, 8 + dataLen);
      for (let i = 0; i + 1 < data.length; i += 2) {
        samples.push(data.readUInt16LE(i) & 0xfff);
      }
    }

    offset += secLen;
  }

  const hz = intervalUs > 0 ? Math.round(1_000_000 / intervalUs) : 150;
  if (hr == null) hr = estimateHrFromSamples(samples, hz);

  const joined = statements.join(" ").replace(/\s+/g, " ").trim();
  let rhythm = mapRhythmFromHr(hr, joined);
  const idx = Number.parseInt(joined, 10);
  if (Number.isInteger(idx) && idx >= 1 && idx <= 17) {
    rhythm = RESULT_LABELS[idx - 1];
  }

  return {
    heartRate: hr,
    rhythm,
    quality: samples.length > 100 ? "ok" : "low",
  };
}

function parseLatest(root, afterMs) {
  const files = listScpFiles(root);
  const fresh = afterMs
    ? files.filter((f) => f.mtimeMs >= afterMs - 2000)
    : files;
  const pick = (fresh.length ? fresh : files)[0];
  if (!pick) return null;
  const buf = fs.readFileSync(pick.filePath);
  const parsed = parseScp(buf);
  if (!parsed) return null;
  return { ...parsed, file: path.basename(pick.filePath), mtimeMs: pick.mtimeMs };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ejectRoot(root) {
  const letter = String(root || "").replace(/[^A-Za-z]/g, "").slice(0, 1);
  if (!letter) return;
  try {
    execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        `$d = (New-Object -ComObject Shell.Application).Namespace(17).ParseName('${letter}:'); if ($d) { $d.InvokeVerb('Eject') }`,
      ],
      { timeout: 8000, windowsHide: true },
    );
  } catch {
    /* ignore */
  }
}

function gateScriptPath() {
  return path.join(process.cwd(), "..", "bp700-bridge", "usb-gate.ps1");
}

async function waitUntil(pred, ms, stepMs = 400) {
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
      "ecg",
    ],
    { windowsHide: true, timeout: 25000 },
  );
}

async function usbGate(action) {
  try {
    await runSchtask(action === "disable" ? "MaindHealthEcgUsbDisable" : "MaindHealthEcgUsbEnable");
  } catch {
    await runGateScript(action);
  }
}

let progress = {
  phase: "idle",
  message: "Listo",
  disk: null,
};
let readingLock = false;
let patientDone = false;

function setProgress(phase, message) {
  progress = { phase, message, disk: findEasyEcgRoot() };
}

async function waitForPatientDone(deadline) {
  setProgress(
    "measure",
    "Cable puesto. Ponga los dedos en las placas unos 30 s. Si pide guardar, acepte. Luego toque Ya terminó.",
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
  const root = findEasyEcgRoot();
  if (!root) {
    throw new Error("No se ve el disco EASY ECG. Encienda el PC-80B y deje el USB puesto.");
  }

  const before = listScpFiles(root);
  const newestBefore = before[0]?.mtimeMs ?? 0;
  let gated = false;

  setProgress("unplug", "Liberando el USB en la PC. El cable se queda puesto…");
  ejectRoot(root);
  await sleep(800);
  if (findEasyEcgRoot()) {
    try {
      await usbGate("disable");
      gated = true;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `No se pudo liberar el USB del ECG (${detail}). Ejecute una sola vez tools\\bp700-bridge\\1-instalar-permiso-usb.bat. El cable se queda puesto.`,
      );
    }
  }

  const gone = await waitUntil(() => !findEasyEcgRoot(), 8000);
  if (!gone && findEasyEcgRoot()) {
    throw new Error(
      "Windows no soltó el disco EASY ECG. Ejecute una sola vez tools\\bp700-bridge\\1-instalar-permiso-usb.bat. El cable se queda puesto.",
    );
  }

  try {
    await waitForPatientDone(deadline);
    setProgress("dump", "Reactivando USB y leyendo el electrocardiograma…");
    if (gated) {
      try {
        await usbGate("enable");
      } catch {
        /* eject-only: el aparato puede remontar solo */
      }
      gated = false;
    }
    const remounted = await waitUntil(() => Boolean(findEasyEcgRoot()), 25000);
    if (!remounted) {
      throw new Error(
        "El disco EASY ECG no volvió a aparecer. Deje el USB puesto, acepte guardar en el aparato y toque Leer otra vez.",
      );
    }
    await sleep(1200);
    const fileDeadline = Date.now() + 35000;
    while (Date.now() < fileDeadline) {
      const parsed = parseLatest(findEasyEcgRoot(), newestBefore + 1);
      if (parsed?.heartRate) return parsed;
      await sleep(1200);
    }
    throw new Error(
      "Sin registro nuevo. Mida 30 s, acepte guardar si lo pide, y toque Ya terminó. El cable se queda puesto.",
    );
  } finally {
    if (gated) {
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
    const disk = findEasyEcgRoot();
    const files = disk ? listScpFiles(disk) : [];
    sendJson(res, 200, {
      ok: Boolean(disk),
      device: "pc-80b",
      disk,
      records: files.length,
      phase: progress.phase,
      message: progress.message,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/progress") {
    sendJson(res, 200, {
      ok: true,
      ...progress,
      disk: findEasyEcgRoot(),
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/continue") {
    patientDone = true;
    sendJson(res, 200, { ok: true });
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
        heartRate: 72,
        rhythm: "Ritmo sinusal normal",
        quality: "good",
        simulated: true,
      });
      return;
    }

    if (readingLock) {
      sendJson(res, 409, { ok: false, error: "Ya hay una lectura de ECG en curso." });
      return;
    }

    readingLock = true;
    try {
      const parsed = await readSession();
      setProgress("idle", "Listo");
      sendJson(res, 200, {
        ok: true,
        heartRate: parsed.heartRate,
        rhythm: parsed.rhythm,
        quality: parsed.quality,
        file: parsed.file,
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

  sendJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`[ecg-bridge] http://${HOST}:${PORT} (USB silenciado por software, cable puesto)`);
});
