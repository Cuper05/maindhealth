"use server";

import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { db } from "@/lib/db";
import { appointmentsTable } from "@/lib/db/schema";
import { getAppointmentStatusByCode } from "@/lib/queries/catalogs";
import { parseAppointmentForm } from "@/lib/validators/appointment";

export async function createAppointment(_prev: unknown, formData: FormData) {
  const session = await getActionSession("appointments:write");
  if ("error" in session) return actionError(session.error);

  const parsed = parseAppointmentForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;
  const scheduledStatus = await getAppointmentStatusByCode("scheduled");
  if (!scheduledStatus) {
    return actionError("Catálogo de estatus no configurado. Ejecuta db:seed.");
  }

  const startAt = new Date(data.startAt);
  const endAt = data.endAt ? new Date(data.endAt) : new Date(startAt.getTime() + 30 * 60 * 1000);

  const [appointment] = await db
    .insert(appointmentsTable)
    .values({
      patientId: data.patientId,
      doctorId: data.doctorId,
      appointmentTypeId: data.appointmentTypeId,
      appointmentStatusId: scheduledStatus.id,
      modality: data.modality,
      startAt,
      endAt,
      reason: data.reason,
      notes: data.notes,
      meetingUrl: data.meetingUrl || null,
    })
    .returning({ id: appointmentsTable.id });

  revalidatePath("/agenda");
  return actionSuccess({ appointmentId: appointment.id });
}
