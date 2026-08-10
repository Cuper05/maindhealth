"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  clinicalRecordsTable,
  patientsTable,
} from "@/lib/db/schema";
import { logActivity } from "@/lib/audit/log-activity";
import { createDailyRoom } from "@/lib/video/daily";
import { formatPersonName } from "@/lib/format/name";
import { getActiveDoctors, getAppointmentStatusByCode } from "@/lib/queries/catalogs";
import { nextChartNumber } from "@/lib/actions/patients";

export async function lookupPatientByChart(chartNumber: string) {
  const session = await getActionSession("intake:write");
  if ("error" in session) return actionError(session.error);

  const trimmed = chartNumber.trim();
  if (!trimmed) return actionError("Ingresa un número de expediente");

  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.chartNumber, trimmed));

  if (!patient) return actionError("Expediente no encontrado");

  return actionSuccess({
    patient: {
      id: patient.id,
      chartNumber: patient.chartNumber,
      name: formatPersonName(patient),
      birthDate: patient.birthDate,
      sex: patient.sex,
      phone: patient.phone,
      email: patient.email,
    },
  });
}

export async function registerStationWalkIn(formData: FormData) {
  const session = await getActionSession("intake:write");
  if ("error" in session) return actionError(session.error);

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastNamePaternal = String(formData.get("lastNamePaternal") ?? "").trim();
  const doctorId = Number(formData.get("doctorId"));
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const birthDate = String(formData.get("birthDate") ?? "").trim() || null;
  const sex = String(formData.get("sex") ?? "").trim() || null;

  if (!firstName || !lastNamePaternal) {
    return actionError("Nombre y apellido paterno son requeridos");
  }
  if (!Number.isFinite(doctorId)) {
    return actionError("Selecciona un médico");
  }

  const doctors = await getActiveDoctors();
  if (!doctors.some((d) => d.id === doctorId)) {
    return actionError("Médico no válido");
  }
  const doctor = doctors.find((d) => d.id === doctorId)!;

  const scheduledStatus = await getAppointmentStatusByCode("scheduled");
  if (!scheduledStatus) return actionError("Catálogo de estatus no configurado");

  const chartNumber = await nextChartNumber();
  const [patient] = await db
    .insert(patientsTable)
    .values({
      chartNumber,
      firstName,
      lastNamePaternal,
      lastNameMaternal: String(formData.get("lastNameMaternal") ?? "").trim() || null,
      birthDate: birthDate || null,
      sex,
      phone,
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
      doctorId,
      appointmentStatusId: scheduledStatus.id,
      modality: "teleconsulta",
      startAt,
      endAt,
      reason: "Walk-in estación telemedicina",
      notes: "Registro en estación — paciente nuevo",
    })
    .returning({ id: appointmentsTable.id });

  const created = await createDailyRoom(appointment.id);
  if (created.ok) {
    await db
      .update(appointmentsTable)
      .set({ meetingUrl: created.room.url, meetingRoomName: created.room.name })
      .where(eq(appointmentsTable.id, appointment.id));
  }

  await logActivity({
    userId: session.userId,
    module: "estacion",
    action: "crear",
    recordId: patient.id,
    detail: `Walk-in ${chartNumber}`,
  });

  revalidatePath("/estacion");
  revalidatePath("/estacion/panel");
  revalidatePath("/agenda");
  return actionSuccess({
    patientId: patient.id,
    appointmentId: appointment.id,
    chartNumber: patient.chartNumber,
    startAt: startAt.toISOString(),
    doctorName: formatPersonName(doctor),
    modality: "teleconsulta",
  });
}
