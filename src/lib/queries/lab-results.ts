import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { labResultsTable, patientsTable } from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";

export async function getLabResultsList() {
  return db
    .select({
      id: labResultsTable.id,
      testName: labResultsTable.testName,
      testCode: labResultsTable.testCode,
      status: labResultsTable.status,
      resultAt: labResultsTable.resultAt,
      patientId: labResultsTable.patientId,
      chartNumber: patientsTable.chartNumber,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
    })
    .from(labResultsTable)
    .innerJoin(patientsTable, eq(labResultsTable.patientId, patientsTable.id))
    .orderBy(desc(labResultsTable.resultAt));
}

export async function getLabResultsForPatient(patientId: number) {
  return db
    .select()
    .from(labResultsTable)
    .where(eq(labResultsTable.patientId, patientId))
    .orderBy(desc(labResultsTable.resultAt));
}

export function formatLabPatientName(row: {
  patientFirstName: string;
  patientLastNamePaternal: string;
  patientLastNameMaternal?: string | null;
}) {
  return formatPersonName({
    firstName: row.patientFirstName,
    lastNamePaternal: row.patientLastNamePaternal,
    lastNameMaternal: row.patientLastNameMaternal,
  });
}
