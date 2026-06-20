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
  catalogAppointmentStatusesTable,
  consultationsTable,
} from "@/lib/db/schema";
import { getAppointmentStatusByCode } from "@/lib/queries/catalogs";
import { logActivity } from "@/lib/audit/log-activity";
import { parseConsultationForm } from "@/lib/validators/consultation";

export async function saveConsultation(_prev: unknown, formData: FormData) {
  const session = await getActionSession("consultations:write");
  if ("error" in session) return actionError(session.error);

  const parsed = parseConsultationForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;

  const [appointment] = await db
    .select()
    .from(appointmentsTable)
    .where(eq(appointmentsTable.id, data.appointmentId));

  if (!appointment) return actionError("Cita no encontrada");

  const doctorId =
    session.role === "doctor" ? session.userId : appointment.doctorId;

  const [existing] = await db
    .select()
    .from(consultationsTable)
    .where(eq(consultationsTable.appointmentId, data.appointmentId));

  let consultationId: number;

  if (existing) {
    await db
      .update(consultationsTable)
      .set({
        reason: data.reason,
        currentIllness: data.currentIllness,
        physicalExam: data.physicalExam,
        diagnosis: data.diagnosis,
        treatmentPlan: data.treatmentPlan,
        instructions: data.instructions,
        clinicalSummary: data.clinicalSummary,
        updatedAt: new Date(),
      })
      .where(eq(consultationsTable.id, existing.id));
    consultationId = existing.id;
  } else {
    const [created] = await db
      .insert(consultationsTable)
      .values({
        appointmentId: data.appointmentId,
        patientId: appointment.patientId,
        doctorId,
        reason: data.reason,
        currentIllness: data.currentIllness,
        physicalExam: data.physicalExam,
        diagnosis: data.diagnosis,
        treatmentPlan: data.treatmentPlan,
        instructions: data.instructions,
        clinicalSummary: data.clinicalSummary,
      })
      .returning({ id: consultationsTable.id });
    consultationId = created.id;
  }

  await logActivity({
    userId: session.userId,
    module: "consultas",
    action: existing ? "actualizar" : "crear",
    recordId: consultationId,
    detail: data.diagnosis,
  });

  const completedStatus = await getAppointmentStatusByCode("completed");
  if (completedStatus) {
    await db
      .update(appointmentsTable)
      .set({
        appointmentStatusId: completedStatus.id,
        updatedAt: new Date(),
      })
      .where(eq(appointmentsTable.id, data.appointmentId));
  }

  revalidatePath("/consultas");
  revalidatePath(`/consultas/cita/${data.appointmentId}`);
  revalidatePath(`/agenda/${data.appointmentId}`);

  return actionSuccess({ consultationId });
}
