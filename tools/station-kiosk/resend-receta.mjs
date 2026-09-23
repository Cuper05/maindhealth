/**
 * Reenvía por correo una receta de estación ya emitida, usando la misma ruta
 * del kiosko (/api/station/prescription/:id/email).
 *
 * Crea una sesión temporal en el kiosko, le apunta la receta del paciente,
 * dispara el envío y borra la sesión temporal.
 *
 *   node --env-file=.env.local tools/station-kiosk/resend-receta.mjs 4
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const prescriptionId = Number(process.argv[2] || 4);

function loadEnvLocal() {
  if (process.env.DATABASE_URL) return;
  try {
    const text = readFileSync(join(ROOT, ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* ignore */
  }
}

function cdpEval(expression) {
  return fetch("http://127.0.0.1:9229/json/list")
    .then((r) => r.json())
    .then(
      (pages) =>
        new Promise((resolve, reject) => {
          const page = (Array.isArray(pages) ? pages : []).find(
            (p) => p.type === "page" && p.webSocketDebuggerUrl,
          );
          if (!page) {
            reject(new Error("no kiosk page"));
            return;
          }
          const ws = new WebSocket(page.webSocketDebuggerUrl);
          const t = setTimeout(() => {
            try { ws.close(); } catch {}
            reject(new Error("timeout"));
          }, 30000);
          ws.addEventListener("open", () => {
            ws.send(JSON.stringify({
              id: 1,
              method: "Runtime.evaluate",
              params: { expression, awaitPromise: true, returnByValue: true },
            }));
          });
          ws.addEventListener("message", (ev) => {
            const msg = JSON.parse(String(ev.data));
            if (msg.id === 1) {
              clearTimeout(t);
              ws.close();
              const val = msg.result?.result?.value;
              resolve(val === undefined ? msg : val);
            }
          });
          ws.addEventListener("error", (err) => {
            clearTimeout(t);
            reject(err);
          });
        }),
    );
}

loadEnvLocal();
const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const [origin] = await sql`
    SELECT id, patient_id, appointment_id, vitals_draft, assessment_draft, clinical_draft
    FROM station_kiosk_sessions
    WHERE (assessment_draft->>'prescriptionId')::int = ${prescriptionId}
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  if (!origin) throw new Error(`Ninguna sesión tiene la receta ${prescriptionId}`);
  console.log("sesión original", origin.id, "paciente", origin.patient_id);

  const created = JSON.parse(
    await cdpEval(`(async () => {
      const res = await fetch("/api/station/session", { method: "POST", credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      return JSON.stringify({ status: res.status, token: body?.session?.token ?? null });
    })()`),
  );
  if (!created.token) throw new Error(`No se creó sesión temporal (${created.status})`);
  console.log("sesión temporal creada");

  await sql`
    UPDATE station_kiosk_sessions
    SET patient_id = ${origin.patient_id},
        appointment_id = ${origin.appointment_id},
        vitals_draft = ${sql.json(origin.vitals_draft)},
        assessment_draft = ${sql.json(origin.assessment_draft)},
        updated_at = NOW()
    WHERE token = ${created.token}
  `;

  const sent = JSON.parse(
    await cdpEval(`(async () => {
      const res = await fetch("/api/station/prescription/${prescriptionId}/email", {
        method: "POST",
        credentials: "same-origin",
      });
      const body = await res.text();
      return JSON.stringify({ status: res.status, body: body.slice(0, 300) });
    })()`),
  );
  console.log("envío", sent);

  if (sent.status === 200) {
    const draft = { ...(origin.assessment_draft ?? {}) };
    const [temp] = await sql`
      SELECT assessment_draft FROM station_kiosk_sessions WHERE token = ${created.token}
    `;
    const tempDraft = temp?.assessment_draft ?? {};
    draft.prescriptionEmailSentAt = tempDraft.prescriptionEmailSentAt ?? new Date().toISOString();
    draft.prescriptionEmailTo = tempDraft.prescriptionEmailTo ?? null;
    draft.prescriptionEmailId = tempDraft.prescriptionEmailId ?? null;
    await sql`
      UPDATE station_kiosk_sessions
      SET assessment_draft = ${sql.json(draft)}, updated_at = NOW()
      WHERE id = ${origin.id}
    `;
    console.log("registrado en la sesión original");
  }

  const cleaned = await cdpEval(`(async () => {
    const res = await fetch("/api/station/session", { method: "DELETE", credentials: "same-origin" });
    return JSON.stringify({ status: res.status });
  })()`);
  await sql`DELETE FROM station_kiosk_sessions WHERE token = ${created.token}`;
  console.log("sesión temporal borrada", cleaned);
} finally {
  await sql.end({ timeout: 2 });
}
