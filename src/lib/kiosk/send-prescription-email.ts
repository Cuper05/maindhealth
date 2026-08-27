import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { patientsTable, stationKioskSessionsTable } from "@/lib/db/schema";
import { normalizeEmail, sendEmail } from "@/lib/email/send";
import { buildStationPrescriptionPdf } from "@/lib/kiosk/station-prescription";
import type { KioskAssessmentDraft } from "@/lib/db/schema/station-kiosk";

/**
 * Genera el PDF de la receta de estación y lo envía al correo del paciente.
 */
export async function emailStationPrescription(token: string, prescriptionId: number) {
  const loaded = await buildStationPrescriptionPdf(token, prescriptionId);
  if (!loaded.ok) return loaded;

  const [session] = await db
    .select()
    .from(stationKioskSessionsTable)
    .where(eq(stationKioskSessionsTable.token, token));

  if (!session?.patientId) {
    return { ok: false as const, error: "Sesión sin paciente" };
  }

  const draft = (session.assessmentDraft ?? {}) as KioskAssessmentDraft;

  if (draft.prescriptionEmailSentAt && Number(draft.prescriptionId) === prescriptionId) {
    return {
      ok: true as const,
      alreadySent: true as const,
      email: draft.prescriptionEmailTo ?? null,
    };
  }

  const [patient] = await db
    .select({
      email: patientsTable.email,
      firstName: patientsTable.firstName,
      chartNumber: patientsTable.chartNumber,
    })
    .from(patientsTable)
    .where(eq(patientsTable.id, session.patientId));

  const email = normalizeEmail(patient?.email);
  if (!email) {
    return {
      ok: false as const,
      error: "El paciente no tiene correo registrado. Debe capturarlo en el alta.",
    };
  }

  const folio = draft.prescriptionFolio;
  const filename = `${loaded.filenameBase}.pdf`;
  const pdfBase64 = Buffer.from(loaded.pdf).toString("base64");
  const name = patient?.firstName?.trim() || "paciente";
  const folioLabel = folio ? ` (folio ${folio})` : "";

  const sent = await sendEmail({
    to: email,
    subject: `Su receta MaindHealth${folioLabel}`,
    html: `
      <p>Hola ${name},</p>
      <p>Adjunto encontrará su receta médica emitida en la estación de telemedicina MaindHealth${folioLabel}.</p>
      <p>Expediente: <strong>${patient?.chartNumber ?? "—"}</strong></p>
      <p>Conserve este correo. Si necesita una copia impresa, puede solicitarla en la estación.</p>
      <p style="color:#64748b;font-size:12px">Este mensaje es automático. No responda a este correo.</p>
    `,
    text: `Hola ${name}. Adjunto su receta MaindHealth${folioLabel}. Expediente ${patient?.chartNumber ?? "—"}.`,
    attachments: [
      {
        filename,
        content: pdfBase64,
        contentType: "application/pdf",
      },
    ],
  });

  if (!sent.ok) {
    return { ok: false as const, error: sent.error, skipped: sent.skipped === true };
  }

  await db
    .update(stationKioskSessionsTable)
    .set({
      assessmentDraft: {
        ...draft,
        prescriptionEmailSentAt: new Date().toISOString(),
        prescriptionEmailTo: email,
        prescriptionEmailId: sent.id,
      },
      updatedAt: new Date(),
    })
    .where(eq(stationKioskSessionsTable.token, token));

  return { ok: true as const, alreadySent: false as const, email, id: sent.id };
}

