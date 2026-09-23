/**
 * Deja el kiosko listo en el paso de temperatura para probar el termómetro
 * con la versión publicada. Reusa el paciente y la cita de la última visita.
 *
 *   node --env-file=.env.local tools/station-kiosk/prep-temp-test.mjs
 */
import postgres from "postgres";

function cdpEval(expression, awaitPromise = true) {
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
          }, 20000);
          ws.addEventListener("open", () => {
            ws.send(JSON.stringify({
              id: 1,
              method: "Runtime.evaluate",
              params: { expression, awaitPromise, returnByValue: true },
            }));
          });
          ws.addEventListener("message", (ev) => {
            const msg = JSON.parse(String(ev.data));
            if (msg.id === 1) {
              clearTimeout(t);
              ws.close();
              const v = msg.result?.result?.value;
              resolve(v === undefined ? msg.result ?? msg : v);
            }
          });
          ws.addEventListener("error", (err) => {
            clearTimeout(t);
            reject(err);
          });
        }),
    );
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 });

try {
  const [last] = await sql`
    SELECT patient_id, appointment_id, vitals_draft, clinical_draft
    FROM station_kiosk_sessions
    WHERE patient_id IS NOT NULL AND appointment_id IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  if (!last) throw new Error("No hay visita previa que reusar");

  const created = JSON.parse(
    await cdpEval(`(async () => {
      const res = await fetch("/api/station/session", { method: "POST", credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      return JSON.stringify({ status: res.status, token: body?.session?.token ?? null });
    })()`),
  );
  if (!created.token) throw new Error(`No se creó sesión (${created.status})`);

  const vitals = { ...(last.vitals_draft ?? {}) };
  delete vitals.temperature;

  await sql`
    UPDATE station_kiosk_sessions
    SET patient_id = ${last.patient_id},
        appointment_id = ${last.appointment_id},
        clinical_draft = ${sql.json(last.clinical_draft ?? {})},
        vitals_draft = ${sql.json(vitals)},
        payment_status = 'approved',
        current_step = 'temperature',
        device_status = 'idle',
        status = 'active',
        updated_at = NOW()
    WHERE token = ${created.token}
  `;

  await cdpEval(`(async () => { window.location.replace("/estacion/paciente"); return "nav"; })()`, false);
  await new Promise((r) => setTimeout(r, 7000));

  console.log(
    await cdpEval(`(async () => {
      const s = await fetch("/api/station/session", { cache: "no-store", credentials: "same-origin" }).then((r) => r.json());
      const btn = Array.from(document.querySelectorAll("button")).find((b) => /leer temperatura ahora/i.test(b.textContent || ""));
      const img = Array.from(document.querySelectorAll("img")).find((i) => String(i.src).includes("thermometer"));
      const steps = Array.from(document.querySelectorAll("ol li")).map((li) => (li.innerText || "").replace(/\\s+/g, " ").trim()).filter(Boolean);
      const doc = document.scrollingElement || document.documentElement;
      return JSON.stringify({
        step: s?.session?.currentStep ?? null,
        temperatura: s?.session?.vitalsDraft?.temperature ?? null,
        boton: btn ? btn.textContent.trim() : null,
        imagen: img ? img.src.split("/").pop() : null,
        pasos: steps,
        scroll: doc.scrollHeight - doc.clientHeight,
      }, null, 1);
    })()`),
  );
} finally {
  await sql.end({ timeout: 2 });
}
