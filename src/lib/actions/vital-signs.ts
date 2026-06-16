"use server";

import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { db } from "@/lib/db";
import { vitalSignsTable } from "@/lib/db/schema";
import {
  computeBmi,
  parseVitalSignsForm,
} from "@/lib/validators/vitals";

export async function captureVitalSigns(_prev: unknown, formData: FormData) {
  const session = await getActionSession("vitals:write");
  if ("error" in session) return actionError(session.error);

  const parsed = parseVitalSignsForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;
  let bmi: string | null = null;
  if (data.weight && data.height) {
    const computed = computeBmi(Number(data.weight), Number(data.height));
    if (computed != null) bmi = String(computed);
  }

  const [record] = await db
    .insert(vitalSignsTable)
    .values({
      patientId: data.patientId,
      appointmentId: data.appointmentId,
      capturedById: session.userId,
      systolicPressure: data.systolicPressure,
      diastolicPressure: data.diastolicPressure,
      heartRate: data.heartRate,
      oxygenSaturation: data.oxygenSaturation,
      temperature: data.temperature,
      weight: data.weight,
      height: data.height,
      glucose: data.glucose,
      bmi,
      symptoms: data.symptoms,
    })
    .returning({ id: vitalSignsTable.id });

  revalidatePath("/triage");
  if (data.appointmentId) {
    revalidatePath(`/agenda/${data.appointmentId}`);
    revalidatePath(`/consultas/cita/${data.appointmentId}`);
  }
  revalidatePath(`/pacientes/${data.patientId}`);

  return actionSuccess({ vitalSignId: record.id });
}
