"use server";

import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { logActivity } from "@/lib/audit/log-activity";
import { db } from "@/lib/db";
import { labResultsTable } from "@/lib/db/schema";
import { parseLabResultForm } from "@/lib/validators/lab-result";

export async function createLabResult(_prev: unknown, formData: FormData) {
  const session = await getActionSession("labs:write");
  if ("error" in session) return actionError(session.error);

  const parsed = parseLabResultForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;
  let results: unknown;
  try {
    results = JSON.parse(data.resultsJson);
  } catch {
    return actionError("El JSON de resultados no es válido");
  }

  const [row] = await db
    .insert(labResultsTable)
    .values({
      patientId: data.patientId,
      consultationId: data.consultationId,
      appointmentId: data.appointmentId,
      testName: data.testName,
      testCode: data.testCode,
      results,
      status: data.status,
      notes: data.notes,
      uploadedById: session.userId,
    })
    .returning({ id: labResultsTable.id });

  await logActivity({
    userId: session.userId,
    module: "laboratorio",
    action: "registrar",
    recordId: row.id,
    detail: data.testName,
  });

  revalidatePath("/laboratorio");
  revalidatePath(`/pacientes/${data.patientId}`);
  revalidatePath("/portal/laboratorio");
  return actionSuccess({ labResultId: row.id });
}
