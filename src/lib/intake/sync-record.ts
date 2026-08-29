import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clinicalRecordsTable } from "@/lib/db/schema";
import type { visitIntakesTable } from "@/lib/db/schema/visit-intakes";
import {
  buildChiefComplaintFromSelection,
  type SymptomSelection,
} from "@/lib/kiosk/symptom-catalog";

type IntakeRow = typeof visitIntakesTable.$inferSelect;

function symptomNoteFromIntake(intake: IntakeRow): string | null {
  const selection = intake.symptomSelection as SymptomSelection | null | undefined;
  if (selection && Array.isArray(selection.primary) && selection.primary.length > 0) {
    const built = buildChiefComplaintFromSelection(selection);
    if (built.trim()) {
      return `Síntomas estación (${intake.completedAt.toLocaleDateString("es-MX")}): ${built}`;
    }
  }
  if (intake.chiefComplaint?.trim()) {
    return `Motivo estación (${intake.completedAt.toLocaleDateString("es-MX")}): ${intake.chiefComplaint.trim()}`;
  }
  return null;
}

function buildChronicConditions(intake: IntakeRow) {
  const parts: string[] = [];
  if (intake.hasDiabetes) {
    parts.push(`Diabetes${intake.diabetesDetails ? `: ${intake.diabetesDetails}` : ""}`);
  }
  if (intake.hasHypertension) {
    parts.push(`Hipertensión${intake.hypertensionDetails ? `: ${intake.hypertensionDetails}` : ""}`);
  }
  if (intake.hasAsthma) {
    parts.push("Asma");
  }
  if (intake.hasHeartDisease) {
    parts.push(`Cardiopatía${intake.heartDiseaseDetails ? `: ${intake.heartDiseaseDetails}` : ""}`);
  }
  if (intake.otherChronicConditions?.trim()) {
    parts.push(intake.otherChronicConditions.trim());
  }
  return parts.join("\n") || null;
}

export async function syncClinicalRecordFromIntake(intake: IntakeRow) {
  const chronicConditions = buildChronicConditions(intake);
  const allergies = intake.hasAllergies ? intake.allergyDetails?.trim() ?? "Sí (sin detalle)" : null;
  const previousSurgeries = intake.hasSurgeries ? intake.surgeryDetails?.trim() ?? null : null;
  const currentMedications = intake.currentMedications?.trim() || null;

  const [existing] = await db
    .select()
    .from(clinicalRecordsTable)
    .where(eq(clinicalRecordsTable.patientId, intake.patientId));

  const patch = {
    allergies: allergies ?? existing?.allergies,
    chronicConditions: chronicConditions ?? existing?.chronicConditions,
    previousSurgeries: previousSurgeries ?? existing?.previousSurgeries,
    currentMedications: currentMedications ?? existing?.currentMedications,
    generalNotes: (() => {
      const symptomNote = symptomNoteFromIntake(intake);
      const changeNote = intake.changesSinceLastVisit?.trim()
        ? `Cambios reportados en intake (${intake.completedAt.toLocaleDateString("es-MX")}): ${intake.changesSinceLastVisit.trim()}`
        : null;
      const extraNote = intake.additionalNotes?.trim()
        ? `Notas intake: ${intake.additionalNotes.trim()}`
        : null;
      const base = (existing?.generalNotes ?? "")
        .split("\n")
        .filter(
          (line) =>
            !line.startsWith("Síntomas estación (") &&
            !line.startsWith("Motivo estación (") &&
            !(changeNote && line.startsWith("Cambios reportados en intake (")) &&
            !(extraNote && line.startsWith("Notas intake:")),
        )
        .join("\n")
        .trim();
      return [base, symptomNote, changeNote, extraNote].filter(Boolean).join("\n") || null;
    })(),
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(clinicalRecordsTable)
      .set(patch)
      .where(eq(clinicalRecordsTable.patientId, intake.patientId));
  } else {
    await db.insert(clinicalRecordsTable).values({
      patientId: intake.patientId,
      ...patch,
    });
  }
}
