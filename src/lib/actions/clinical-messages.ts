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
import { clinicalMessagesTable } from "@/lib/db/schema";
import { logActivity } from "@/lib/audit/log-activity";
import { markMessagesReadForUser } from "@/lib/queries/messages";
import { parseMessageForm } from "@/lib/validators/phase4";

export async function sendClinicalMessage(_prev: unknown, formData: FormData) {
  const session = await getActionSession("messages:write");
  if ("error" in session) return actionError(session.error);

  const parsed = parseMessageForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  let patientId = parsed.data.patientId;
  if (session.role === "patient") {
    patientId = (await resolvePatientId({
      userId: session.userId,
      role: session.role,
      isLoggedIn: true,
    })) ?? undefined;
    if (!patientId) return actionError("Expediente no vinculado");
  }

  if (!patientId) return actionError("Paciente requerido");

  const [message] = await db
    .insert(clinicalMessagesTable)
    .values({
      patientId,
      senderUserId: session.userId,
      senderRole: session.role,
      body: parsed.data.body.trim(),
      readByPatientAt: session.role === "patient" ? new Date() : null,
      readByStaffAt: session.role === "patient" ? null : new Date(),
    })
    .returning({ id: clinicalMessagesTable.id });

  await logActivity({
    userId: session.userId,
    module: "portal",
    action: "registrar",
    recordId: message.id,
    detail: `Mensaje paciente #${patientId}`,
  });

  revalidatePath("/portal/mensajes");
  revalidatePath("/mensajes");
  revalidatePath(`/pacientes/${patientId}`);
  return actionSuccess({ messageId: message.id });
}

export async function markMessagesRead(patientId: number) {
  const session = await getActionSession("messages:view");
  if ("error" in session) return actionError(session.error);

  await markMessagesReadForUser(patientId, session);

  revalidatePath("/portal/mensajes");
  revalidatePath("/mensajes");
  return actionSuccess({});
}
