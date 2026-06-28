import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  catalogAppointmentStatusesTable,
  patientsTable,
  usersTable,
  visitIntakesTable,
  vitalSignsTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";

export async function getVisitIntakeByAppointment(appointmentId: number) {
  const [row] = await db
    .select()
    .from(visitIntakesTable)
    .where(eq(visitIntakesTable.appointmentId, appointmentId));
  return row ?? null;
}

export async function isVisitIntakeComplete(appointmentId: number) {
  const intake = await getVisitIntakeByAppointment(appointmentId);
  return Boolean(intake);
}

export async function getTodayStationAppointments() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const rows = await db
    .select({
      id: appointmentsTable.id,
      startAt: appointmentsTable.startAt,
      modality: appointmentsTable.modality,
      reason: appointmentsTable.reason,
      patientId: appointmentsTable.patientId,
      chartNumber: patientsTable.chartNumber,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
      statusName: catalogAppointmentStatusesTable.name,
      statusCode: catalogAppointmentStatusesTable.code,
      intakeId: visitIntakesTable.id,
      intakeCompletedAt: visitIntakesTable.completedAt,
      hasVitals: sql<boolean>`exists (
        select 1 from ${vitalSignsTable}
        where ${vitalSignsTable.appointmentId} = ${appointmentsTable.id}
      )`.as("has_vitals"),
    })
    .from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
    .innerJoin(
      catalogAppointmentStatusesTable,
      eq(appointmentsTable.appointmentStatusId, catalogAppointmentStatusesTable.id),
    )
    .leftJoin(visitIntakesTable, eq(visitIntakesTable.appointmentId, appointmentsTable.id))
    .where(
      and(
        gte(appointmentsTable.startAt, start),
        lte(appointmentsTable.startAt, end),
      ),
    )
    .orderBy(appointmentsTable.startAt);

  return rows.map((row) => ({
    ...row,
    patientName: formatPersonName({
      firstName: row.patientFirstName,
      lastNamePaternal: row.patientLastNamePaternal,
      lastNameMaternal: row.patientLastNameMaternal,
    }),
    doctorName: formatPersonName({
      firstName: row.doctorFirstName,
      lastNamePaternal: row.doctorLastNamePaternal,
      lastNameMaternal: row.doctorLastNameMaternal,
    }),
    intakeComplete: Boolean(row.intakeId),
    hasVitals: Boolean(row.hasVitals),
  }));
}

export async function getAppointmentForIntake(appointmentId: number) {
  const [row] = await db
    .select({
      id: appointmentsTable.id,
      startAt: appointmentsTable.startAt,
      modality: appointmentsTable.modality,
      reason: appointmentsTable.reason,
      patientId: appointmentsTable.patientId,
      chartNumber: patientsTable.chartNumber,
      patientFirstName: patientsTable.firstName,
      patientLastNamePaternal: patientsTable.lastNamePaternal,
      patientLastNameMaternal: patientsTable.lastNameMaternal,
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
    })
    .from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
    .where(eq(appointmentsTable.id, appointmentId));

  if (!row) return null;

  const intake = await getVisitIntakeByAppointment(appointmentId);

  return {
    ...row,
    patientName: formatPersonName({
      firstName: row.patientFirstName,
      lastNamePaternal: row.patientLastNamePaternal,
      lastNameMaternal: row.patientLastNameMaternal,
    }),
    doctorName: formatPersonName({
      firstName: row.doctorFirstName,
      lastNamePaternal: row.doctorLastNamePaternal,
      lastNameMaternal: row.doctorLastNameMaternal,
    }),
    intake,
  };
}

export async function getRecentIntakesForPatient(patientId: number, limit = 3) {
  return db
    .select()
    .from(visitIntakesTable)
    .where(eq(visitIntakesTable.patientId, patientId))
    .orderBy(desc(visitIntakesTable.completedAt))
    .limit(limit);
}
