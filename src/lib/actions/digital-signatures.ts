"use server";

import { createHash } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { logActivity } from "@/lib/audit/log-activity";
import { db } from "@/lib/db";
import {
  consultationsTable,
  digitalSignaturesTable,
  prescriptionsTable,
  stationKioskSessionsTable,
  usersTable,
  type KioskAssessmentDraft,
} from "@/lib/db/schema";

export async function signPrescription(prescriptionId: number) {
  const session = await getActionSession("signatures:write");
  if ("error" in session) return actionError(session.error);

  const [prescription] = await db
    .select()
    .from(prescriptionsTable)
    .where(eq(prescriptionsTable.id, prescriptionId));

  if (!prescription) return actionError("Receta no encontrada");
  if (session.role === "doctor" && prescription.doctorId !== session.userId) {
    return actionError("Solo el médico emisor puede firmar");
  }

  const [existing] = await db
    .select()
    .from(digitalSignaturesTable)
    .where(
      and(
        eq(digitalSignaturesTable.entityType, "prescription"),
        eq(digitalSignaturesTable.entityId, prescriptionId),
      ),
    );

  if (existing) return actionError("Esta receta ya está firmada");

  const [doctor] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, prescription.doctorId));

  const signedAt = new Date();
  const payload = `${prescriptionId}:${prescription.doctorId}:${signedAt.toISOString()}`;
  const signatureHash = createHash("sha256").update(payload).digest("hex");

  await db.insert(digitalSignaturesTable).values({
    entityType: "prescription",
    entityId: prescriptionId,
    signedById: session.userId,
    signerName: session.name,
    signerLicense: doctor?.professionalLicense ?? null,
    signatureHash,
    signedAt,
    metadata: JSON.stringify({ algorithm: "sha256", payloadVersion: 1 }),
  });

  const [consultation] = await db
    .select({ appointmentId: consultationsTable.appointmentId })
    .from(consultationsTable)
    .where(eq(consultationsTable.id, prescription.consultationId));

  let printQueued = false;
  if (consultation?.appointmentId) {
    const [kiosk] = await db
      .select()
      .from(stationKioskSessionsTable)
      .where(eq(stationKioskSessionsTable.appointmentId, consultation.appointmentId))
      .orderBy(desc(stationKioskSessionsTable.updatedAt))
      .limit(1);

    if (kiosk) {
      const draft: KioskAssessmentDraft = {
        ...((kiosk.assessmentDraft ?? {}) as KioskAssessmentDraft),
        prescriptionId,
        printPending: true,
        printRequestedAt: signedAt.toISOString(),
        printCompletedAt: null,
        printError: null,
      };
      await db
        .update(stationKioskSessionsTable)
        .set({
          assessmentDraft: draft,
          updatedAt: new Date(),
        })
        .where(eq(stationKioskSessionsTable.id, kiosk.id));
      printQueued = true;
    }
  }

  await logActivity({
    userId: session.userId,
    module: "firmas",
    action: "firmar",
    recordId: prescriptionId,
    detail: `Receta #${prescriptionId}${printQueued ? " · impresión en estación" : ""}`,
  });

  revalidatePath("/recetas");
  if (consultation) {
    revalidatePath(`/consultas/cita/${consultation.appointmentId}`);
  }
  return actionSuccess({ signatureHash, printQueued });
}

export async function signConsultation(consultationId: number) {
  const session = await getActionSession("signatures:write");
  if ("error" in session) return actionError(session.error);

  const [consultation] = await db
    .select()
    .from(consultationsTable)
    .where(eq(consultationsTable.id, consultationId));

  if (!consultation) return actionError("Consulta no encontrada");

  const signedAt = new Date();
  const payload = `${consultationId}:${consultation.doctorId}:${signedAt.toISOString()}`;
  const signatureHash = createHash("sha256").update(payload).digest("hex");

  const [doctor] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, consultation.doctorId));

  await db.insert(digitalSignaturesTable).values({
    entityType: "consultation",
    entityId: consultationId,
    signedById: session.userId,
    signerName: session.name,
    signerLicense: doctor?.professionalLicense ?? null,
    signatureHash,
    signedAt,
    metadata: JSON.stringify({ algorithm: "sha256", payloadVersion: 1 }),
  });

  await logActivity({
    userId: session.userId,
    module: "firmas",
    action: "firmar",
    recordId: consultationId,
    detail: `Consulta #${consultationId}`,
  });

  revalidatePath(`/consultas/cita/${consultation.appointmentId}`);
  return actionSuccess({ signatureHash });
}
