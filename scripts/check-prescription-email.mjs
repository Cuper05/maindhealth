/** Últimas recetas de estación: folio, correo del paciente y si el correo salió. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function loadEnvLocal() {
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

loadEnvLocal();
const url = process.env.DATABASE_URL;
if (!url) {
  console.log("DATABASE_URL missing");
  process.exit(1);
}
const sql = postgres(url, { max: 1 });
try {
  const rows = await sql`
    SELECT s.id, s.appointment_id, s.patient_id, s.status, s.current_step,
           s.updated_at, s.assessment_draft, p.email AS patient_email
    FROM station_kiosk_sessions s
    LEFT JOIN patients p ON p.id = s.patient_id
    WHERE s.updated_at >= NOW() - INTERVAL '6 hours'
    ORDER BY s.updated_at DESC
    LIMIT 6
  `;
  for (const row of rows) {
    const d = row.assessment_draft && typeof row.assessment_draft === "object" ? row.assessment_draft : {};
    console.log({
      session: row.id,
      appointment: row.appointment_id,
      status: row.status,
      step: row.current_step,
      updated: row.updated_at,
      patientEmail: row.patient_email,
      prescriptionId: d.prescriptionId ?? null,
      folio: d.prescriptionFolio ?? null,
      emailSentAt: d.prescriptionEmailSentAt ?? null,
      emailTo: d.prescriptionEmailTo ?? null,
      emailId: d.prescriptionEmailId ?? null,
    });
  }
} finally {
  await sql.end({ timeout: 2 });
}
