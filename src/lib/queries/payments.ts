import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  consultationPaymentsTable,
  patientsTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";

export async function getPaymentsList() {
  return db
    .select({
      id: consultationPaymentsTable.id,
      appointmentId: consultationPaymentsTable.appointmentId,
      amountCents: consultationPaymentsTable.amountCents,
      currency: consultationPaymentsTable.currency,
      method: consultationPaymentsTable.method,
      status: consultationPaymentsTable.status,
      paidAt: consultationPaymentsTable.paidAt,
      startAt: appointmentsTable.startAt,
      chartNumber: patientsTable.chartNumber,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
    })
    .from(consultationPaymentsTable)
    .innerJoin(appointmentsTable, eq(consultationPaymentsTable.appointmentId, appointmentsTable.id))
    .innerJoin(patientsTable, eq(consultationPaymentsTable.patientId, patientsTable.id))
    .orderBy(desc(consultationPaymentsTable.createdAt));
}

export function formatPaymentPatientName(row: {
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
