import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  patientsTable,
  stationKioskSessionsTable,
  usersTable,
} from "@/lib/db/schema";
import { formatPersonName } from "@/lib/format/name";

/**
 * Pacientes de kiosk escalados a teleconsulta (status waiting_doctor).
 * Left-join del médico: la cola no debe desaparecer si falta el join de usuario.
 */
export async function getWaitingDoctorStationSessions() {
  const rows = await db
    .select({
      sessionId: stationKioskSessionsTable.id,
      status: stationKioskSessionsTable.status,
      updatedAt: stationKioskSessionsTable.updatedAt,
      assessmentDraft: stationKioskSessionsTable.assessmentDraft,
      appointmentId: appointmentsTable.id,
      meetingUrl: appointmentsTable.meetingUrl,
      modality: appointmentsTable.modality,
      patientId: patientsTable.id,
      chartNumber: patientsTable.chartNumber,
      firstName: patientsTable.firstName,
      lastNamePaternal: patientsTable.lastNamePaternal,
      lastNameMaternal: patientsTable.lastNameMaternal,
      doctorFirstName: usersTable.firstName,
      doctorLastNamePaternal: usersTable.lastNamePaternal,
      doctorLastNameMaternal: usersTable.lastNameMaternal,
    })
    .from(stationKioskSessionsTable)
    .innerJoin(
      appointmentsTable,
      eq(stationKioskSessionsTable.appointmentId, appointmentsTable.id),
    )
    .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
    .leftJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
    .where(eq(stationKioskSessionsTable.status, "waiting_doctor"))
    .orderBy(desc(stationKioskSessionsTable.updatedAt));

  return rows.map((row) => ({
    sessionId: row.sessionId,
    appointmentId: row.appointmentId,
    patientId: row.patientId,
    chartNumber: row.chartNumber,
    patientName: formatPersonName(row),
    doctorName: row.doctorFirstName
      ? formatPersonName({
          firstName: row.doctorFirstName,
          lastNamePaternal: row.doctorLastNamePaternal ?? "",
          lastNameMaternal: row.doctorLastNameMaternal,
        })
      : "Sin asignar",
    meetingUrl: row.meetingUrl,
    modality: row.modality,
    updatedAt: row.updatedAt,
    redFlags: row.assessmentDraft?.redFlags ?? [],
    summary: row.assessmentDraft?.summary ?? null,
    roomError: row.assessmentDraft?.roomError ?? null,
  }));
}
