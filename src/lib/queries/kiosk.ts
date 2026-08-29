import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  catalogAppointmentStatusesTable,
  deviceReadingsTable,
  patientsTable,
  stationKioskSessionsTable,
  usersTable,
  visitIntakesTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";
import { normalizePhoneDigits } from "@/lib/patients/find-existing";

export async function getKioskSessionByToken(token: string) {
  const [row] = await db
    .select()
    .from(stationKioskSessionsTable)
    .where(eq(stationKioskSessionsTable.token, token));
  return row ?? null;
}

export async function getTodayKioskAppointments() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const rows = await db
    .select({
      id: appointmentsTable.id,
      startAt: appointmentsTable.startAt,
      patientId: appointmentsTable.patientId,
      chartNumber: patientsTable.chartNumber,
      firstName: patientsTable.firstName,
      lastNamePaternal: patientsTable.lastNamePaternal,
      lastNameMaternal: patientsTable.lastNameMaternal,
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
      meetingUrl: appointmentsTable.meetingUrl,
      modality: appointmentsTable.modality,
      intakeId: visitIntakesTable.id,
    })
    .from(appointmentsTable)
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .innerJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
    .innerJoin(
      catalogAppointmentStatusesTable,
      eq(appointmentsTable.appointmentStatusId, catalogAppointmentStatusesTable.id),
    )
    .leftJoin(visitIntakesTable, eq(visitIntakesTable.appointmentId, appointmentsTable.id))
    .where(and(gte(appointmentsTable.startAt, start), lte(appointmentsTable.startAt, end)))
    .orderBy(appointmentsTable.startAt);

  return rows.map((r) => ({
    id: r.id,
    startAt: r.startAt.toISOString(),
    patientId: r.patientId,
    chartNumber: r.chartNumber,
    patientName: formatPersonName(r),
    doctorName: formatPersonName({
      firstName: r.doctorFirstName,
      lastNamePaternal: r.doctorLastNamePaternal,
      lastNameMaternal: r.doctorLastNameMaternal,
    }),
    meetingUrl: r.meetingUrl,
    modality: r.modality,
    intakeComplete: Boolean(r.intakeId),
  }));
}

export async function lookupPatientForKiosk(query: {
  chartNumber?: string;
  phone?: string;
  email?: string;
  curp?: string;
  firstName?: string;
  lastNamePaternal?: string;
  birthDate?: string;
}) {
  const conditions = [];
  if (query.chartNumber?.trim()) {
    conditions.push(eq(patientsTable.chartNumber, query.chartNumber.trim()));
  }
  const phoneDigits = normalizePhoneDigits(query.phone);
  if (phoneDigits.length >= 10) {
    conditions.push(
      sql`regexp_replace(coalesce(${patientsTable.phone}, ''), '[^0-9]', '', 'g') = ${phoneDigits}`,
    );
  } else if (query.phone?.trim()) {
    conditions.push(eq(patientsTable.phone, query.phone.trim()));
  }
  if (query.email?.trim()) {
    conditions.push(eq(patientsTable.email, query.email.trim().toLowerCase()));
  }
  if (query.curp?.trim()) {
    conditions.push(eq(patientsTable.curp, query.curp.trim().toUpperCase()));
  }
  if (query.firstName?.trim() && query.lastNamePaternal?.trim() && query.birthDate?.trim()) {
    conditions.push(
      and(
        sql`lower(trim(${patientsTable.firstName})) = ${query.firstName.trim().toLowerCase()}`,
        sql`lower(trim(${patientsTable.lastNamePaternal})) = ${query.lastNamePaternal.trim().toLowerCase()}`,
        eq(patientsTable.birthDate, query.birthDate.trim()),
      )!,
    );
  }
  if (conditions.length === 0) return null;

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(
      and(
        conditions.length === 1 ? conditions[0] : or(...conditions)!,
        sql`${patientsTable.status} is distinct from 'deleted'`,
      ),
    )
    .orderBy(
      sql`case when ${patientsTable.status} = 'active' then 0 when ${patientsTable.status} = 'archived' then 1 else 2 end`,
      desc(patientsTable.id),
    )
    .limit(1);

  if (!patient) return null;
  return {
    id: patient.id,
    chartNumber: patient.chartNumber,
    name: formatPersonName(patient),
    birthDate: patient.birthDate,
    sex: patient.sex,
    phone: patient.phone,
    email: patient.email,
    emergencyContactName: patient.emergencyContactName,
    emergencyContactPhone: patient.emergencyContactPhone,
    hasKioskLogin: Boolean(patient.kioskUsername && patient.kioskPasswordHash),
  };
}

export async function getLatestDeviceReadingsForAppointment(appointmentId: number, since: Date) {
  const rows = await db
    .select()
    .from(deviceReadingsTable)
    .where(
      and(
        eq(deviceReadingsTable.appointmentId, appointmentId),
        gte(deviceReadingsTable.recordedAt, since),
      ),
    )
    .orderBy(desc(deviceReadingsTable.recordedAt))
    .limit(20);
  return rows;
}

export async function getKioskAppointmentContext(appointmentId: number) {
  const [row] = await db
    .select({
      id: appointmentsTable.id,
      startAt: appointmentsTable.startAt,
      meetingUrl: appointmentsTable.meetingUrl,
      modality: appointmentsTable.modality,
      statusCode: catalogAppointmentStatusesTable.code,
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
    .where(eq(appointmentsTable.id, appointmentId));
  if (!row) return null;
  return {
    ...row,
    startAt: row.startAt.toISOString(),
    doctorName: formatPersonName({
      firstName: row.doctorFirstName,
      lastNamePaternal: row.doctorLastNamePaternal,
      lastNameMaternal: row.doctorLastNameMaternal,
    }),
  };
}
