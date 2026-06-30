import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  clinicalRecordsTable,
  patientsTable,
} from "@/lib/db/schema";
import { nextChartNumber } from "@/lib/actions/patients";
import { getActiveDoctors, getAppointmentStatusByCode } from "@/lib/queries/catalogs";
import { formatPersonName } from "@/lib/format/name";
import { createDailyRoom } from "@/lib/video/daily";

export async function registerKioskWalkIn(input: {
  firstName: string;
  lastNamePaternal: string;
  lastNameMaternal?: string;
  birthDate?: string;
  sex?: string;
  phone?: string;
  email?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  doctorId: number;
}) {
  const doctors = await getActiveDoctors();
  const doctor = doctors.find((d) => d.id === input.doctorId);
  if (!doctor) return { ok: false as const, error: "Médico no válido" };

  const scheduledStatus = await getAppointmentStatusByCode("scheduled");
  if (!scheduledStatus) return { ok: false as const, error: "Catálogo no configurado" };

  const chartNumber = await nextChartNumber();
  const [patient] = await db
    .insert(patientsTable)
    .values({
      chartNumber,
      firstName: input.firstName,
      lastNamePaternal: input.lastNamePaternal,
      lastNameMaternal: input.lastNameMaternal ?? null,
      birthDate: input.birthDate ?? null,
      sex: input.sex ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      emergencyContactName: input.emergencyContactName ?? null,
      emergencyContactPhone: input.emergencyContactPhone ?? null,
    })
    .returning({ id: patientsTable.id, chartNumber: patientsTable.chartNumber });

  await db.insert(clinicalRecordsTable).values({ patientId: patient.id });

  const startAt = new Date();
  startAt.setMinutes(startAt.getMinutes() + 15 - (startAt.getMinutes() % 15));
  const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);

  const [appointment] = await db
    .insert(appointmentsTable)
    .values({
      patientId: patient.id,
      doctorId: input.doctorId,
      appointmentStatusId: scheduledStatus.id,
      modality: "teleconsulta",
      startAt,
      endAt,
      reason: "Walk-in estación paciente",
      notes: "Registro en kiosco",
    })
    .returning({ id: appointmentsTable.id });

  const room = await createDailyRoom(appointment.id);
  if (room) {
    await db
      .update(appointmentsTable)
      .set({ meetingUrl: room.url, meetingRoomName: room.name })
      .where(eq(appointmentsTable.id, appointment.id));
  }

  return {
    ok: true as const,
    patientId: patient.id,
    appointmentId: appointment.id,
    chartNumber: patient.chartNumber,
    patientName: formatPersonName({
      firstName: input.firstName,
      lastNamePaternal: input.lastNamePaternal,
      lastNameMaternal: input.lastNameMaternal,
    }),
    startAt: startAt.toISOString(),
    doctorName: formatPersonName(doctor),
    modality: "teleconsulta",
  };
}
