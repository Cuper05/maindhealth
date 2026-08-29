/**
 * Bridge ECG Lepu/Creative PC-80B (Easy ECG Monitor).
 * El aparato se monta como disco USB "EASY ECG" con archivos .SCP.
 * http://127.0.0.1:3928
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const HOST = "127.0.0.1";
const PORT = Number(process.env.ECG_BRIDGE_PORT || 3928);
const READ_TIMEOUT_MS = Number(process.env.ECG_READ_TIMEOUT_MS || 90000);

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
    /* el cable se queda; si no expulsa, el aparato puede seguir en modo PC */
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    const root = findEasyEcgRoot();
    const files = root ? listScpFiles(root) : [];
    sendJson(res, 200, {
      ok: Boolean(root),
      device: "pc-80b",
      disk: root,
      records: files.length,
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
        heartRate: 72,
        rhythm: "Ritmo sinusal normal",
        quality: "good",
        simulated: true,
      });
      return;
    }

    const started = Date.now();
    const root = findEasyEcgRoot();
    if (!root) {
      sendJson(res, 503, {
        ok: false,
        error:
          "No se ve el disco EASY ECG. Encienda el PC-80B, conéctelo por USB y vuelva a leer.",
      });
      return;
    }

    const recentWindowMs = Number(process.env.ECG_RECENT_MS || 180000);
    const before = listScpFiles(root);
    const newestBefore = before[0]?.mtimeMs ?? 0;
    const alreadySaved = parseLatest(root, Date.now() - recentWindowMs);
    if (alreadySaved?.heartRate && newestBefore >= started - recentWindowMs) {
      sendJson(res, 200, {
        ok: true,
        heartRate: alreadySaved.heartRate,
        rhythm: alreadySaved.rhythm,
        quality: alreadySaved.quality,
        file: alreadySaved.file,
      });
      return;
    }

    ejectRoot(root);

    while (Date.now() - started < READ_TIMEOUT_MS) {
      const parsed = parseLatest(root, newestBefore + 1);
      if (parsed?.heartRate) {
        sendJson(res, 200, {
          ok: true,
          heartRate: parsed.heartRate,
          rhythm: parsed.rhythm,
          quality: parsed.quality,
          file: parsed.file,
        });
        return;
      }
      await sleep(1500);
    }

    sendJson(res, 504, {
      ok: false,
      error:
        "Sin registro nuevo del PC-80B. Mida 30 s con los dedos en las placas, acepte guardar si lo pide, y toque Leer otra vez. El cable se queda puesto.",
    });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`[ecg-bridge] http://${HOST}:${PORT}`);
});
