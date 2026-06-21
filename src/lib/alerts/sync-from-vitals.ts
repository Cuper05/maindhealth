import { db } from "@/lib/db";
import { clinicalAlertsTable } from "@/lib/db/schema";
import { getVitalAlerts } from "@/lib/reports/vital-alerts";

type VitalInput = {
  patientId: number;
  vitalSignId?: number;
  systolicPressure?: string | null;
  diastolicPressure?: string | null;
  heartRate?: string | null;
  oxygenSaturation?: string | null;
  temperature?: string | null;
  glucose?: string | null;
  source?: string;
};

function severityForNote(note: string): "low" | "medium" | "high" {
  if (note.includes("Hipoxemia") || note.includes("Hipotensión")) return "high";
  if (note.includes("Fiebre") || note.includes("Hipertensión")) return "medium";
  return "low";
}

export async function syncClinicalAlertsFromVitals(input: VitalInput) {
  const alerts = getVitalAlerts({
    systolicPressure: input.systolicPressure ?? null,
    diastolicPressure: input.diastolicPressure ?? null,
    heartRate: input.heartRate ?? null,
    oxygenSaturation: input.oxygenSaturation ?? null,
    temperature: input.temperature ?? null,
    glucose: input.glucose ?? null,
  });
  if (alerts.length === 0) return [];

  const rows = await db
    .insert(clinicalAlertsTable)
    .values(
      alerts.map((alert) => ({
        patientId: input.patientId,
        vitalSignId: input.vitalSignId,
        severity: severityForNote(alert.note),
        metric: alert.metric,
        value: alert.value,
        message: `${alert.metric} ${alert.value} — ${alert.note}`,
        source: input.source ?? "rules",
      })),
    )
    .returning();

  return rows;
}
