import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointmentsTable, visitIntakesTable } from "@/lib/db/schema";
import { syncClinicalRecordFromIntake } from "@/lib/intake/sync-record";
import { parseVisitIntakePayload } from "@/lib/validators/visit-intake";

export async function saveKioskVisitIntake(payload: unknown) {
  const parsed = parseVisitIntakePayload(payload);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  const [appointment] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, data.appointmentId));
  if (!appointment) return { ok: false as const, error: "Cita no encontrada" };

  const [existing] = await db
    .select({ id: visitIntakesTable.id })
    .from(visitIntakesTable)
    .where(eq(visitIntakesTable.appointmentId, data.appointmentId));
  if (existing) return { ok: true as const, intakeId: existing.id };

  const now = new Date();
  const [intake] = await db
    .insert(visitIntakesTable)
    .values({
      appointmentId: data.appointmentId,
      patientId: appointment.patientId,
      completedByUserId: null,
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
  return { ok: true as const, intakeId: intake.id };
}
