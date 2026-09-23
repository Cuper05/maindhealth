/**
 * Abre /estacion/sala/{id} en la Dell (Edge CDP 9228) cuando hay waiting_doctor.
 * No depende del JS de producción, que oculta esperas con videoOpened=true.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CDP = "http://127.0.0.1:9228";
const ORIGIN = "https://health.maindsteel.com.mx";

function loadEnvLocal() {
  const envPath = join(ROOT, ".env.local");
  try {
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}

async function latestWaitingAppointmentId() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const sql = postgres(url, { max: 1 });
  try {
    const rows = await sql`
      SELECT appointment_id AS id, device_status, status, assessment_draft
      FROM station_kiosk_sessions
      WHERE status = 'waiting_doctor'
        AND appointment_id IS NOT NULL
        AND updated_at >= NOW() - INTERVAL '30 minutes'
      ORDER BY updated_at DESC
      LIMIT 5
    `;
    for (const row of rows) {
      const draft =
        row.assessment_draft && typeof row.assessment_draft === "object"
          ? row.assessment_draft
          : {};
      if (draft.callEnded === true || row.device_status === "call_ended") continue;
      return Number(row.id);
    }
    return null;
  } finally {
    await sql.end({ timeout: 2 });
  }
}

async function listPages() {
  const res = await fetch(`${CDP}/json/list`);
  if (!res.ok) throw new Error(`CDP ${res.status}`);
  const pages = await res.json();
  return (Array.isArray(pages) ? pages : []).filter((p) => p.type === "page");
}

function cdpSend(wsUrl, method, params) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(new Error(`CDP timeout ${method}`));
    }, 5000);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ id: 1, method, params }));
    });
    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(String(ev.data));
        if (msg.id === 1) {
          clearTimeout(timer);
          ws.close();
          resolve(msg);
        }
      } catch {
        /* ignore */
      }
    });
    ws.addEventListener("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

const VIDEO_LOCK_JS = `(() => {
  if (window.__maindhealthVideoLock) return "already";
  window.__maindhealthVideoLock = 1;
  const css = \`
    [data-station-sala] video:not([class*="bottom-"]):not([data-station-local-preview]) {
      position: fixed !important;
      inset: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      max-width: none !important;
      max-height: none !important;
      object-fit: cover !important;
      border-radius: 0 !important;
      z-index: 6 !important;
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
    }
    [data-station-sala] video[class*="bottom-"],
    [data-station-sala] video[data-station-local-preview] {
      position: fixed !important;
      left: 0 !important;
      top: 0 !important;
      width: 2px !important;
      height: 2px !important;
      opacity: 0 !important;
      pointer-events: none !important;
      z-index: 0 !important;
    }
  \`;
  const apply = () => {
    let s = document.getElementById("maindhealth-video-lock");
    if (!s) {
      s = document.createElement("style");
      s.id = "maindhealth-video-lock";
      (document.head || document.documentElement).appendChild(s);
    }
    s.textContent = css;
  };
  apply();
  document.addEventListener("DOMContentLoaded", apply);
  return "css-lock";
})()`;

async function injectVideoLock(pageWs) {
  try {
    await cdpSend(pageWs, "Page.addScriptToEvaluateOnNewDocument", {
      source: VIDEO_LOCK_JS,
    });
  } catch {
    /* ignore */
  }
  try {
    const msg = await cdpSend(pageWs, "Runtime.evaluate", {
      expression: VIDEO_LOCK_JS,
      returnByValue: true,
    });
    const value = msg?.result?.result?.value;
    if (value) console.log("video-lock", value);
  } catch (err) {
    console.log("video-lock fail", err instanceof Error ? err.message : err);
  }
}

async function injectEndCallWatch(pageWs) {
  await injectVideoLock(pageWs);
  const expression = `(() => {
    if (window.__maindhealthEndWatch) return "already";
    const appt = Number((location.pathname.match(/\\/estacion\\/sala\\/(\\d+)/) || [])[1]);
    if (!Number.isFinite(appt) || appt <= 0) return "no-sala";
    window.__maindhealthEndWatch = 1;
    let leaving = false;
    const go = () => {
      if (leaving) return;
      leaving = true;
      window.location.replace("/estacion");
    };
    window.setInterval(() => {
      if (leaving) return;
      fetch("/api/station/video-opened?appointmentId=" + appt, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => { if (d && d.callEnded === true) go(); })
        .catch(() => {});
    }, 800);
    return "watching-" + appt;
  })()`;
  try {
    const msg = await cdpSend(pageWs, "Runtime.evaluate", {
      expression,
      returnByValue: true,
    });
    const value = msg?.result?.result?.value;
    if (value) console.log("end-watch", value);
  } catch (err) {
    console.log("end-watch fail", err instanceof Error ? err.message : err);
  }
}

async function grantMedia(wsUrl) {
  for (const origin of [ORIGIN, "https://maindhealth.daily.co"]) {
    try {
      await cdpSend(wsUrl, "Browser.grantPermissions", {
        origin,
        permissions: ["videoCapture", "audioCapture"],
      });
    } catch {
      /* page session may not support Browser.* */
    }
  }
}

async function openSala(appointmentId) {
  const target = `${ORIGIN}/estacion/sala/${appointmentId}`;
  const pages = await listPages();
  const page = pages[0];
  if (!page?.webSocketDebuggerUrl) {
    throw new Error("No hay pestaña de estación en CDP 9228");
  }

  let browserWs = page.webSocketDebuggerUrl;
  try {
    const ver = await fetch(`${CDP}/json/version`).then((r) => r.json());
    if (ver?.webSocketDebuggerUrl) browserWs = ver.webSocketDebuggerUrl;
  } catch {
    /* ignore */
  }
  if (page.url.includes(`/estacion/sala/${appointmentId}`)) {
    console.log(`ALREADY ${page.url}`);
    await injectEndCallWatch(page.webSocketDebuggerUrl);
    return { ok: true, already: true, url: page.url };
  }

  await grantMedia(browserWs);

  try {
    await cdpSend(page.webSocketDebuggerUrl, "Page.navigate", { url: target });
  } catch {
    await cdpSend(page.webSocketDebuggerUrl, "Runtime.evaluate", {
      expression: `window.location.replace(${JSON.stringify(target)})`,
      returnByValue: true,
    });
  }

  await new Promise((r) => setTimeout(r, 1500));
  const after = (await listPages())[0];
  if (after?.webSocketDebuggerUrl) {
    await injectEndCallWatch(after.webSocketDebuggerUrl);
  }
  console.log(`NAV ${page.url} -> ${after?.url || "?"}`);
  return { ok: true, url: after?.url || target };
}

async function main() {
  loadEnvLocal();
  const forced = Number(process.argv[2]);
  const appointmentId = Number.isFinite(forced) && forced > 0 ? forced : await latestWaitingAppointmentId();
  if (!appointmentId) {
    try {
      const pages = await listPages();
      const page = pages[0];
      if (page?.url?.includes("/estacion/sala/") && page.webSocketDebuggerUrl) {
        await injectEndCallWatch(page.webSocketDebuggerUrl);
        console.log("NO_WAITING_BUT_SALA");
        return;
      }
    } catch {
      /* ignore */
    }
    console.log("NO_WAITING");
    return;
  }
  console.log(`WAITING_APPT ${appointmentId}`);
  await openSala(appointmentId);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
