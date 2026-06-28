"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { db } from "@/lib/db";
import { appointmentsTable, visitIntakesTable } from "@/lib/db/schema";
import { logActivity } from "@/lib/audit/log-activity";
import { syncClinicalRecordFromIntake } from "@/lib/intake/sync-record";
import { parseVisitIntakeForm, parseVisitIntakePayload } from "@/lib/validators/visit-intake";

export async function submitVisitIntake(_prev: unknown, formData: FormData) {
  const session = await getActionSession("intake:write");
  if ("error" in session) return actionError(session.error);

  const parsed = parseVisitIntakeForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  return saveVisitIntake(parsed.data, session.userId);
}

export async function submitStationIntakePayload(payload: unknown) {
  const session = await getActionSession("intake:write");
  if ("error" in session) return actionError(session.error);

  const parsed = parseVisitIntakePayload(payload);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  return saveVisitIntake(parsed.data, session.userId);
}

async function saveVisitIntake(
  data: import("@/lib/validators/visit-intake").VisitIntakeInput,
  userId: number,
) {

  const [appointment] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, data.appointmentId));

  if (!appointment) return actionError("Cita no encontrada");

  const [existing] = await db
    .select({ id: visitIntakesTable.id })
    .from(visitIntakesTable)
    .where(eq(visitIntakesTable.appointmentId, data.appointmentId));

  if (existing) {
    return actionError("El cuestionario de esta cita ya fue completado");
  }

  const now = new Date();

  const [intake] = await db
    .insert(visitIntakesTable)
    .values({
      appointmentId: data.appointmentId,
      patientId: appointment.patientId,
      completedByUserId: userId,
      patientType: data.patientType,
      dataConfirmedAt: now,
      consentSignerName: data.consentSignerName.trim(),
      consentAcceptedAt: now,
      chiefComplaint: data.chiefComplaint.trim(),
      hasDiabetes: data.hasDiabetes,
      diabetesDetails: data.diabetesDetails?.trim(),
      hasHypertension: data.hasHypertension,
      hypertensionDetails: data.hypertensionDetails?.trim(),
      hasHeartDisease: data.hasHeartDisease,
      heartDiseaseDetails: data.heartDiseaseDetails?.trim(),
      hasAllergies: data.hasAllergies,
      allergyDetails: data.allergyDetails?.trim(),
      hasSurgeries: data.hasSurgeries,
      surgeryDetails: data.surgeryDetails?.trim(),
      otherChronicConditions: data.otherChronicConditions?.trim(),
      currentMedications: data.currentMedications?.trim(),
      smokingStatus: data.smokingStatus,
      alcoholUse: data.alcoholUse,
      changesSinceLastVisit: data.changesSinceLastVisit?.trim(),
      additionalNotes: data.additionalNotes?.trim(),
    })
    .returning();

  await syncClinicalRecordFromIntake(intake);

  await logActivity({
    userId,
    module: "estacion",
    action: "registrar",
    recordId: intake.id,
    detail: `Intake cita #${data.appointmentId}`,
  });

  revalidatePath("/estacion");
  revalidatePath("/estacion/flujo");
  revalidatePath(`/estacion/intake/${data.appointmentId}`);
  revalidatePath(`/agenda/${data.appointmentId}`);
  revalidatePath(`/pacientes/${appointment.patientId}`);
  return actionSuccess({ intakeId: intake.id, appointmentId: data.appointmentId });
}
