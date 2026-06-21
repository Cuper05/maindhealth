import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  catalogAppointmentStatusesTable,
  catalogAppointmentTypesTable,
  clinicalDocumentsTable,
  consultationPaymentsTable,
  labResultsTable,
  patientsTable,
  prescriptionItemsTable,
  prescriptionsTable,
  usersTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";

export async function getPortalAppointments(patientId: number) {
  return db
    .select({
      id: appointmentsTable.id,
      startAt: appointmentsTable.startAt,
      endAt: appointmentsTable.endAt,
      modality: appointmentsTable.modality,
      reason: appointmentsTable.reason,
      meetingUrl: appointmentsTable.meetingUrl,
      statusName: catalogAppointmentStatusesTable.name,
      typeName: catalogAppointmentTypesTable.name,
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
    })
    .from(appointmentsTable)
    .innerJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
    .innerJoin(
      catalogAppointmentStatusesTable,
      eq(appointmentsTable.appointmentStatusId, catalogAppointmentStatusesTable.id),
    )
    .leftJoin(
      catalogAppointmentTypesTable,
      eq(appointmentsTable.appointmentTypeId, catalogAppointmentTypesTable.id),
    )
    .where(eq(appointmentsTable.patientId, patientId))
    .orderBy(desc(appointmentsTable.startAt));
}

export async function getPortalAppointment(patientId: number, appointmentId: number) {
  const [row] = await db
    .select({
      id: appointmentsTable.id,
      startAt: appointmentsTable.startAt,
      endAt: appointmentsTable.endAt,
      modality: appointmentsTable.modality,
      reason: appointmentsTable.reason,
      meetingUrl: appointmentsTable.meetingUrl,
      meetingRoomName: appointmentsTable.meetingRoomName,
      statusName: catalogAppointmentStatusesTable.name,
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
    })
    .from(appointmentsTable)
    .innerJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
    .innerJoin(
      catalogAppointmentStatusesTable,
      eq(appointmentsTable.appointmentStatusId, catalogAppointmentStatusesTable.id),
    )
    .where(
      and(
        eq(appointmentsTable.id, appointmentId),
        eq(appointmentsTable.patientId, patientId),
      ),
    );

  return row ?? null;
}

export async function getPortalPrescriptions(patientId: number) {
  const rows = await db
    .select({
      id: prescriptionsTable.id,
      issuedAt: prescriptionsTable.issuedAt,
      generalNotes: prescriptionsTable.generalNotes,
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
    })
    .from(prescriptionsTable)
    .innerJoin(usersTable, eq(prescriptionsTable.doctorId, usersTable.id))
    .where(eq(prescriptionsTable.patientId, patientId))
    .orderBy(desc(prescriptionsTable.issuedAt));

  const withItems = await Promise.all(
    rows.map(async (row) => {
      const items = await db
        .select()
        .from(prescriptionItemsTable)
        .where(eq(prescriptionItemsTable.prescriptionId, row.id));
      return {
        ...row,
        doctorName: formatPersonName({
          firstName: row.doctorFirstName,
          lastNamePaternal: row.doctorLastNamePaternal,
          lastNameMaternal: row.doctorLastNameMaternal,
        }),
        items,
      };
    }),
  );

  return withItems;
}

export async function getPortalDocuments(patientId: number) {
  return db
    .select({
      id: clinicalDocumentsTable.id,
      title: clinicalDocumentsTable.fileName,
      uploadedAt: clinicalDocumentsTable.uploadedAt,
      mimeType: clinicalDocumentsTable.mimeType,
    })
    .from(clinicalDocumentsTable)
    .where(eq(clinicalDocumentsTable.patientId, patientId))
    .orderBy(desc(clinicalDocumentsTable.uploadedAt));
}

export async function getPortalLabResults(patientId: number) {
  return db
    .select()
    .from(labResultsTable)
    .where(eq(labResultsTable.patientId, patientId))
    .orderBy(desc(labResultsTable.resultAt));
}

export async function getPortalPayments(patientId: number) {
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
    })
    .from(consultationPaymentsTable)
    .innerJoin(appointmentsTable, eq(consultationPaymentsTable.appointmentId, appointmentsTable.id))
    .where(eq(consultationPaymentsTable.patientId, patientId))
    .orderBy(desc(consultationPaymentsTable.createdAt));
}

export async function getPaymentForAppointment(appointmentId: number) {
  const [row] = await db
    .select()
    .from(consultationPaymentsTable)
    .where(eq(consultationPaymentsTable.appointmentId, appointmentId));
  return row ?? null;
}

export async function getPatientSummary(patientId: number) {
  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.id, patientId));
  return patient ?? null;
}
