"use server";

import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { logActivity } from "@/lib/audit/log-activity";
import { db } from "@/lib/db";
import { deviceReadingsTable, vitalSignsTable } from "@/lib/db/schema";
import { parseDeviceReadingForm } from "@/lib/validators/device-reading";

function calcBmi(weight?: string, height?: string) {
  const w = weight ? Number(weight) : NaN;
  const h = height ? Number(height) / 100 : NaN;
  if (!Number.isFinite(w) || !Number.isFinite(h) || h <= 0) return null;
  return (w / (h * h)).toFixed(2);
}

export async function recordDeviceReading(_prev: unknown, formData: FormData) {
  const session = await getActionSession("readings:write");
  if ("error" in session) return actionError(session.error);

  const parsed = parseDeviceReadingForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;
  let vitalSignId: number | undefined;

  if (data.syncToVitals && data.patientId) {
    const bmi = calcBmi(data.weight, undefined);
    const [vital] = await db
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
        glucose: data.glucose,
        bmi: bmi ?? undefined,
        symptoms: data.notes,
      })
      .returning({ id: vitalSignsTable.id });
    vitalSignId = vital.id;
  }

  const [reading] = await db
    .insert(deviceReadingsTable)
    .values({
      medicalDeviceId: data.medicalDeviceId,
      patientId: data.patientId,
      appointmentId: data.appointmentId,
      vitalSignId,
      rawPayload: data,
      systolicPressure: data.systolicPressure,
      diastolicPressure: data.diastolicPressure,
      heartRate: data.heartRate,
      oxygenSaturation: data.oxygenSaturation,
      temperature: data.temperature,
      weight: data.weight,
      glucose: data.glucose,
      notes: data.notes,
      capturedById: session.userId,
      source: "device",
    })
    .returning({ id: deviceReadingsTable.id });

  await logActivity({
    userId: session.userId,
    module: "dispositivos",
    action: "registrar",
    recordId: reading.id,
    detail: `Lectura equipo #${data.medicalDeviceId}`,
  });

  revalidatePath(`/dispositivos/${data.medicalDeviceId}`);
  if (data.patientId) revalidatePath(`/pacientes/${data.patientId}`);
  return actionSuccess({ readingId: reading.id, vitalSignId });
}
