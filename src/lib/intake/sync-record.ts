import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clinicalRecordsTable } from "@/lib/db/schema";
import type { visitIntakesTable } from "@/lib/db/schema/visit-intakes";

type IntakeRow = typeof visitIntakesTable.$inferSelect;

function buildChronicConditions(intake: IntakeRow) {
  const parts: string[] = [];
  if (intake.hasDiabetes) {
    parts.push(`Diabetes${intake.diabetesDetails ? `: ${intake.diabetesDetails}` : ""}`);
  }
  if (intake.hasHypertension) {
    parts.push(`Hipertensión${intake.hypertensionDetails ? `: ${intake.hypertensionDetails}` : ""}`);
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
    generalNotes: [
      existing?.generalNotes,
      intake.changesSinceLastVisit?.trim()
        ? `Cambios reportados en intake (${intake.completedAt.toLocaleDateString("es-MX")}): ${intake.changesSinceLastVisit.trim()}`
        : null,
      intake.additionalNotes?.trim() ? `Notas intake: ${intake.additionalNotes.trim()}` : null,
    ]
      .filter(Boolean)
      .join("\n") || existing?.generalNotes,
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
