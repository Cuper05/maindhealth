"use server";

import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { db } from "@/lib/db";
import { followUpsTable } from "@/lib/db/schema";
import { logActivity } from "@/lib/audit/log-activity";
import { parseFollowUpForm } from "@/lib/validators/follow-up";

export async function createFollowUp(_prev: unknown, formData: FormData) {
  const session = await getActionSession("followups:write");
  if ("error" in session) return actionError(session.error);

  const parsed = parseFollowUpForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;
  const doctorId =
    session.role === "doctor" ? session.userId : data.doctorId;

  const [followUp] = await db
    .insert(followUpsTable)
    .values({
      patientId: data.patientId,
      consultationId: data.consultationId,
      doctorId,
      followUpAt: new Date(data.followUpAt),
      evolution: data.evolution,
      notes: data.notes,
      nextReviewAt: data.nextReviewAt ? new Date(data.nextReviewAt) : null,
    })
    .returning({ id: followUpsTable.id });

  await logActivity({
    userId: session.userId,
    module: "seguimientos",
    action: "crear",
    recordId: followUp.id,
    detail: `Paciente #${data.patientId}`,
  });

  revalidatePath("/seguimientos");
  revalidatePath("/");
  revalidatePath(`/pacientes/${data.patientId}`);

  return actionSuccess({ followUpId: followUp.id, patientId: data.patientId });
}
