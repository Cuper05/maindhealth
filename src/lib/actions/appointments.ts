"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { db } from "@/lib/db";
import { appointmentsTable } from "@/lib/db/schema";
import { getAppointmentStatusByCode } from "@/lib/queries/catalogs";
import { logActivity } from "@/lib/audit/log-activity";
import { createDailyRoom } from "@/lib/video/daily";
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

  let meetingUrl = data.meetingUrl || null;
  let meetingRoomName: string | null = null;

  if (data.modality === "teleconsulta" && !meetingUrl) {
    const room = await createDailyRoom(appointment.id);
    if (room) {
      meetingUrl = room.url;
      meetingRoomName = room.name;
      await db
        .update(appointmentsTable)
        .set({ meetingUrl, meetingRoomName })
        .where(eq(appointmentsTable.id, appointment.id));
    }
  }

  await logActivity({
    userId: session.userId,
    module: "agenda",
    action: "crear",
    recordId: appointment.id,
    detail: `Cita paciente #${data.patientId}`,
  });

  revalidatePath("/agenda");
  return actionSuccess({ appointmentId: appointment.id });
}
