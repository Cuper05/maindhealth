"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { resolvePatientId } from "@/lib/auth/patient-scope";
import { db } from "@/lib/db";
import {
  appointmentsTable,
  consultationPaymentsTable,
} from "@/lib/db/schema";
import { logActivity } from "@/lib/audit/log-activity";
import { getAppointmentStatusByCode } from "@/lib/queries/catalogs";
import { createDailyRoom } from "@/lib/video/daily";
import { parsePortalAppointmentForm } from "@/lib/validators/portal-appointment";

const DEFAULT_FEE_CENTS = 35000;

export async function bookPortalAppointment(_prev: unknown, formData: FormData) {
  const session = await getActionSession("appointments:book");
  if ("error" in session) return actionError(session.error);

  const patientId = await resolvePatientId({
    userId: session.userId,
    role: session.role,
    isLoggedIn: true,
    patientId: undefined,
  });
  if (!patientId) return actionError("Tu cuenta no está vinculada a un expediente");

  const parsed = parsePortalAppointmentForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;
  const startAt = new Date(data.startAt);
  if (startAt.getTime() < Date.now()) {
    return actionError("La fecha debe ser futura");
  }

  const scheduledStatus = await getAppointmentStatusByCode("scheduled");
  if (!scheduledStatus) return actionError("Catálogo de estatus no configurado");

  const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);

  const [appointment] = await db
    .insert(appointmentsTable)
    .values({
      patientId,
      doctorId: data.doctorId,
      appointmentStatusId: scheduledStatus.id,
      modality: data.modality,
      startAt,
      endAt,
      reason: data.reason,
      notes: "Autocita portal paciente",
    })
    .returning({ id: appointmentsTable.id });

  if (data.modality === "teleconsulta") {
    const created = await createDailyRoom(appointment.id);
    if (created.ok) {
      await db
        .update(appointmentsTable)
        .set({ meetingUrl: created.room.url, meetingRoomName: created.room.name })
        .where(eq(appointmentsTable.id, appointment.id));
    }
  }

  await db.insert(consultationPaymentsTable).values({
    appointmentId: appointment.id,
    patientId,
    amountCents: DEFAULT_FEE_CENTS,
    method: "pending",
    status: "pending",
    notes: "Consulta agendada desde portal",
  });

  await logActivity({
    userId: session.userId,
    module: "portal",
    action: "crear",
    recordId: appointment.id,
    detail: `Autocita paciente #${patientId}`,
  });

  revalidatePath("/portal/citas");
  revalidatePath("/portal/pagos");
  revalidatePath("/agenda");
  return actionSuccess({ appointmentId: appointment.id });
}
