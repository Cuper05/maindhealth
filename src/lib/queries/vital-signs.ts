import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { patientsTable, vitalSignsTable } from "@/lib/db/schema";
import type { VitalChartRecord } from "@/lib/vitals/chart-metrics";

function serializeVital(row: typeof vitalSignsTable.$inferSelect): VitalChartRecord {
  return {
    id: row.id,
    recordedAt: row.recordedAt.toISOString(),
    systolicPressure: row.systolicPressure,
    diastolicPressure: row.diastolicPressure,
    heartRate: row.heartRate,
    oxygenSaturation: row.oxygenSaturation,
    temperature: row.temperature,
    weight: row.weight,
    glucose: row.glucose,
    bmi: row.bmi,
  };
}

export async function getPatientVitalsHistory(patientId: number, limit = 120) {
  const rows = await db
    .select()
    .from(vitalSignsTable)
    .where(eq(vitalSignsTable.patientId, patientId))
    .orderBy(asc(vitalSignsTable.recordedAt))
    .limit(limit);

  return rows.map(serializeVital);
}

export async function getPatientVitalsRecent(patientId: number, limit = 20) {
  const rows = await db
    .select()
    .from(vitalSignsTable)
    .where(eq(vitalSignsTable.patientId, patientId))
    .orderBy(desc(vitalSignsTable.recordedAt))
    .limit(limit);

  return rows;
}

export async function getPatientsWithVitals() {
  return db
    .selectDistinct({
      id: patientsTable.id,
      chartNumber: patientsTable.chartNumber,
      firstName: patientsTable.firstName,
      lastNamePaternal: patientsTable.lastNamePaternal,
      lastNameMaternal: patientsTable.lastNameMaternal,
    })
    .from(vitalSignsTable)
    .innerJoin(patientsTable, eq(vitalSignsTable.patientId, patientsTable.id))
    .orderBy(asc(patientsTable.lastNamePaternal), asc(patientsTable.firstName));
}
