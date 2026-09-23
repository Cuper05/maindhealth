/**
 * Servicio local — Lejia HW-701 (peso + altura) vía RS232→USB.
 * http://127.0.0.1:3930
 *
 * Protocolo real (4800 8N1, ASCII):
 *   LJid...$LJTime...$q0$W08710$H1585$b347$Y$
 *   W##### → kg/100   (08710 = 87.10 kg)
 *   H####  → cm/10    (1585  = 158.5 cm)
 *   b###   → BMI/10   (347   = 34.7)
 *
 *   set HW701_PORT=COM7
 *   set HW701_BAUD=4800
 *   node server.mjs
 */

import http from "node:http";
import { SerialPort } from "serialport";

const HOST = "127.0.0.1";
const PORT = Number(process.env.BRIDGE_PORT || 3930);
const SERIAL_PATH = process.env.HW701_PORT || "";
const DEFAULT_BAUD = Number(process.env.HW701_BAUD || 4800);

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

/**
 * @param {string} text
 * @returns {{ weightKg: number, heightM: number, bmi: number, deviceId?: string, rawMatch: string } | null}
 */
function parseLejiaFrame(text) {
  // Puede llegar fragmentado o repetido; buscar última trama completa.
  const re =
    /LJid([^$]*)\$LJTime([^$]*)\$q([^$]*)\$W(\d{4,5})\$H(\d{3,4})\$b(\d{2,4})\$Y\$/g;
  let match = null;
  let m;
  while ((m = re.exec(text)) !== null) match = m;
  if (!match) {
    // Variante tolerante: campos W/H/b en cualquier orden relativo cercano
    const w = text.match(/\$W(\d{4,5})\$/);
    const h = text.match(/\$H(\d{3,4})\$/);
    const b = text.match(/\$b(\d{2,4})\$/);
    if (!w || !h) return null;
    const weightKg = Number(w[1]) / 100;
    const heightCm = Number(h[1]) / 10;
    const bmi = b ? Number(b[1]) / 10 : Number((weightKg / (heightCm / 100) ** 2).toFixed(1));
    if (!(weightKg >= 20 && weightKg <= 250)) return null;
    if (!(heightCm >= 100 && heightCm <= 230)) return null;
    return {
      weightKg: Number(weightKg.toFixed(2)),
      heightM: Number((heightCm / 100).toFixed(3)),
      bmi: Number(bmi.toFixed(1)),
      rawMatch: `W${w[1]}$H${h[1]}$b${b?.[1] ?? ""}`,
    };
  }

  const weightKg = Number(match[4]) / 100;
  const heightCm = Number(match[5]) / 10;
  const bmi = Number(match[6]) / 10;
  if (!(weightKg >= 20 && weightKg <= 250)) return null;
  if (!(heightCm >= 100 && heightCm <= 230)) return null;

  return {
    weightKg: Number(weightKg.toFixed(2)),
    heightM: Number((heightCm / 100).toFixed(3)),
    bmi: Number(bmi.toFixed(1)),
    deviceId: match[1] || undefined,
    rawMatch: match[0],
  };
}

async function openPort(path, baudRate) {
  const port = new SerialPort({
    path,
    baudRate,
    dataBits: 8,
    parity: "none",
    stopBits: 1,
    autoOpen: false,
  });
  await new Promise((resolve, reject) => {
    port.open((err) => (err ? reject(err) : resolve()));
  });
  return port;
}

async function readOnce({ path, baudRate, timeoutMs = 50000 }) {
  const port = await openPort(path, baudRate);
  let text = "";
  let bytes = 0;

  const onData = (chunk) => {
    bytes += chunk.length;
    text += chunk.toString("latin1");
    console.log(`[hw701] +${chunk.length} bytes (total ${bytes}): ${chunk.toString("latin1").replace(/\r?\n/g, "\\n")}`);
  };
  port.on("data", onData);

  // La HW-701 suele empujar la trama sola al terminar; probes suaves por si acaso.
  const probes = [Buffer.from([0x05]), Buffer.from("R\r\n"), Buffer.from("\r")];
  let i = 0;
  const probeTimer = setInterval(() => {
    if (!port.isOpen) return;
    port.write(probes[i % probes.length], () => {});
    i += 1;
  }, 4000);

  console.log(`[hw701] Esperando medición en ${path}@${baudRate} (hasta ${Math.round(timeoutMs / 1000)}s). Súbase ahora.`);
  const started = Date.now();
  try {
    while (Date.now() - started < timeoutMs) {
      const parsed = parseLejiaFrame(text);
      if (parsed) {
        console.log(
          `[hw701] OK → ${parsed.weightKg} kg · ${(parsed.heightM * 100).toFixed(1)} cm · IMC ${parsed.bmi}`,
        );
        return { ...parsed, bytes, baudRate, path, raw: text.slice(-120) };
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    const err = new Error(
      `Sin trama LJ de la báscula en ${path}@${baudRate} (${bytes} bytes). Súbase, espere peso+altura en el LED y reintente.`,
    );
    err.code = "NO_READING";
    err.bytes = bytes;
    err.raw = text.slice(-200);
    throw err;
  } finally {
    clearInterval(probeTimer);
    port.off("data", onData);
    if (port.isOpen) await new Promise((r) => port.close(() => r()));
  }
}

function isCh340(port) {
  return /ch340|1a86|wch/i.test(
    `${port.manufacturer || ""} ${port.friendlyName || ""} ${port.vendorId || ""}`,
  );
}

async function canOpen(path) {
  try {
    const port = await openPort(path, DEFAULT_BAUD);
    await new Promise((resolve) => port.close(() => resolve()));
    return true;
  } catch {
    return false;
  }
}

async function resolveSerialPath(preferred) {
  const ports = await SerialPort.list();
  const seen = new Set();
  const candidates = [];
  const push = (path) => {
    const key = String(path || "").toUpperCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    candidates.push(path);
  };

  if (preferred) push(preferred);
  if (SERIAL_PATH) push(SERIAL_PATH);
  for (const port of ports) {
    if (isCh340(port)) push(port.path);
  }
  for (const port of ports) {
    const name = `${port.friendlyName || ""}`;
    if (/active management/i.test(name)) continue;
    if (/^COM4$/i.test(port.path || "")) continue;
    push(port.path);
  }

  for (const path of candidates) {
    if (await canOpen(path)) return path;
    console.log(`[hw701] skip ${path}: no se puede abrir`);
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    sendJson(res, 204, {});
    return;
  }

  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    const ports = await SerialPort.list();
    sendJson(res, 200, {
      ok: true,
      device: "lejia-hw701",
      baud: DEFAULT_BAUD,
      configuredPort: SERIAL_PATH || null,
      resolvedPort: await resolveSerialPath(),
      ports: ports.map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer || null,
        friendlyName: p.friendlyName || null,
      })),
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
      console.log("[hw701] /read simulate");
      sendJson(res, 200, {
        ok: true,
        weight: 87.1,
        height: 1.585,
        bmi: 34.7,
        simulated: true,
      });
      return;
    }

    try {
      console.log("[hw701] /read solicitado");
      const path = await resolveSerialPath(body.port);
      if (!path) {
        sendJson(res, 503, {
          ok: false,
          error:
            "No hay puerto COM de la báscula. El adaptador USB-RS232 (CH340) debe estar enchufado. Si Windows lo movió de COM, reconecte el USB y reintente.",
        });
        return;
      }
      const baud = Number(body.baud || DEFAULT_BAUD);
      const result = await readOnce({ path, baudRate: baud });
      sendJson(res, 200, {
        ok: true,
        weight: result.weightKg,
        height: result.heightM,
        bmi: result.bmi,
        deviceId: result.deviceId,
        bytes: result.bytes,
        path: result.path,
        baudRate: result.baudRate,
        raw: result.rawMatch,
      });
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : String(err);
      console.error("[hw701] /read error:", rawMsg);
      const missing = /file not found|cannot find|no se encuentra/i.test(rawMsg);
      sendJson(res, 503, {
        ok: false,
        error: missing
          ? "El puerto COM de la báscula no existe (Windows lo movió). Reconecte el USB CH340 y pulse Leer báscula de nuevo."
          : rawMsg,
        code: err?.code,
        bytes: err?.bytes,
        raw: err?.raw,
      });
    }
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`[hw701-scale-bridge] http://${HOST}:${PORT}`);
  console.log(`  HW701_PORT=${SERIAL_PATH || "(auto CH340)"}`);
  console.log(`  baud=${DEFAULT_BAUD} (protocolo LJ ASCII)`);
});
