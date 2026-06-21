import { desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  ALERT_SEVERITY_LABELS,
  clinicalAlertsTable,
  patientsTable,
  type AlertSeverity,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";

export async function getClinicalAlertsList(pendingOnly = false) {
  const query = db
    .select({
      id: clinicalAlertsTable.id,
      patientId: clinicalAlertsTable.patientId,
      severity: clinicalAlertsTable.severity,
      metric: clinicalAlertsTable.metric,
      value: clinicalAlertsTable.value,
      message: clinicalAlertsTable.message,
      source: clinicalAlertsTable.source,
      acknowledgedAt: clinicalAlertsTable.acknowledgedAt,
      createdAt: clinicalAlertsTable.createdAt,
      chartNumber: patientsTable.chartNumber,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
    })
    .from(clinicalAlertsTable)
    .innerJoin(patientsTable, eq(clinicalAlertsTable.patientId, patientsTable.id))
    .$dynamic();

  if (pendingOnly) {
    query.where(isNull(clinicalAlertsTable.acknowledgedAt));
  }

  return query.orderBy(desc(clinicalAlertsTable.createdAt));
}

export function formatAlertPatient(row: {
  patientFirstName: string;
  patientLastNamePaternal: string;
  patientLastNameMaternal?: string | null;
  chartNumber: string;
}) {
  return `${row.chartNumber} — ${formatPersonName({
    firstName: row.patientFirstName,
    lastNamePaternal: row.patientLastNamePaternal,
    lastNameMaternal: row.patientLastNameMaternal,
  })}`;
}

export function formatAlertSeverity(severity: string) {
  return ALERT_SEVERITY_LABELS[severity as AlertSeverity] ?? severity;
}

export async function countPendingAlerts() {
  const rows = await db
    .select({ id: clinicalAlertsTable.id })
    .from(clinicalAlertsTable)
    .where(isNull(clinicalAlertsTable.acknowledgedAt));
  return rows.length;
}
