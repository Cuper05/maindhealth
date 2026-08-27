import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { appointmentsTable, patientsTable, visitIntakesTable } from "@/lib/db/schema";
import { syncClinicalRecordFromIntake } from "@/lib/intake/sync-record";
import { parseVisitIntakePayload } from "@/lib/validators/visit-intake";

export async function saveKioskVisitIntake(payload: unknown) {
  const parsed = parseVisitIntakePayload(payload);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;
  const hasAsthma = Boolean(data.hasAsthma);

  const [appointment] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, data.appointmentId));
  if (!appointment) return { ok: false as const, error: "Cita no encontrada" };

  const now = new Date();
  const intakeValues = {
    patientType: data.patientType,
    dataConfirmedAt: now,
    consentSignerName: data.consentSignerName.trim(),
    consentAcceptedAt: now,
    chiefComplaint: data.chiefComplaint.trim(),
    symptomSelection: data.symptomSelection ?? null,
    clinicalSnapshot: data.clinicalSnapshot ?? null,
    hasDiabetes: data.hasDiabetes,
    diabetesDetails: data.diabetesDetails?.trim(),
    hasHypertension: data.hasHypertension,
    hypertensionDetails: data.hypertensionDetails?.trim(),
    hasAsthma,
    hasHeartDisease: data.hasHeartDisease,
    heartDiseaseDetails: data.heartDiseaseDetails?.trim(),
    hasAllergies: data.hasAllergies,
    allergyDetails: data.allergyDetails?.trim(),
    hasSurgeries: data.hasSurgeries,
    surgeryDetails: data.surgeryDetails?.trim(),
    otherChronicConditions:
      data.otherChronicConditions?.trim() ||
      (hasAsthma ? "Asma" : undefined),
    currentMedications: data.currentMedications?.trim(),
    smokingStatus: data.smokingStatus,
    alcoholUse: data.alcoholUse,
    changesSinceLastVisit: data.changesSinceLastVisit?.trim(),
    additionalNotes: data.additionalNotes?.trim(),
    source: data.source ?? "kiosk",
  };

  const [existing] = await db
    .select({ id: visitIntakesTable.id })
    .from(visitIntakesTable)
    .where(eq(visitIntakesTable.appointmentId, data.appointmentId));

  const [intake] = existing
    ? await db
        .update(visitIntakesTable)
        .set(intakeValues)
        .where(eq(visitIntakesTable.id, existing.id))
        .returning()
    : await db
        .insert(visitIntakesTable)
        .values({
          appointmentId: data.appointmentId,
          patientId: appointment.patientId,
          completedByUserId: null,
          ...intakeValues,
        })
        .returning();

  await syncClinicalRecordFromIntake(intake);

  try {
    await db
      .update(patientsTable)
      .set({
        kioskAntecedents: {
          hasDiabetes: data.hasDiabetes,
          hasHypertension: data.hasHypertension,
          hasAsthma,
          hasHeartDisease: data.hasHeartDisease,
          hasAllergies: data.hasAllergies,
          allergyDetails: data.allergyDetails?.trim() || "",
          currentMedications: data.currentMedications?.trim() || "",
        },
        updatedAt: new Date(),
      })
      .where(eq(patientsTable.id, appointment.patientId));
  } catch (err) {
    console.error("[intake] kioskAntecedents", err);
  }

  return { ok: true as const, intakeId: intake.id };
}
