"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  actionError,
  getActionSession,
} from "@/lib/auth/action-session";
import { logActivity } from "@/lib/audit/log-activity";
import { db } from "@/lib/db";
import { deviceReadingsTable, vitalSignsTable } from "@/lib/db/schema";

type UsbReadingInput = {
  medicalDeviceId: number;
  oxygenSaturation: number;
  heartRate: number;
  patientId?: number;
  syncToVitals?: boolean;
};

export async function recordUsbOximeterReading(input: UsbReadingInput) {
  const session = await getActionSession("readings:write");
  if ("error" in session) return actionError(session.error);

  const spo2 = Number(input.oxygenSaturation);
  const hr = Number(input.heartRate);
  if (!Number.isFinite(spo2) || spo2 < 70 || spo2 > 100) {
    return actionError("SpO2 inválido");
  }
  if (!Number.isFinite(hr) || hr < 30 || hr > 250) {
    return actionError("FC inválida");
  }
  if (!Number.isFinite(input.medicalDeviceId) || input.medicalDeviceId <= 0) {
    return actionError("Equipo inválido");
  }

  const oxygenSaturation = String(Math.round(spo2));
  const heartRate = String(Math.round(hr));
  const syncToVitals = Boolean(input.syncToVitals && input.patientId);
  let vitalSignId: number | undefined;

  if (syncToVitals && input.patientId) {
    const [vital] = await db
      .insert(vitalSignsTable)
      .values({
        patientId: input.patientId,
        capturedById: session.userId,
        heartRate,
        oxygenSaturation,
      })
      .returning({ id: vitalSignsTable.id });
    vitalSignId = vital.id;
  }

  const [reading] = await db
    .insert(deviceReadingsTable)
    .values({
      medicalDeviceId: input.medicalDeviceId,
      patientId: input.patientId,
      vitalSignId,
      rawPayload: {
        source: "web-serial-cms50dplus",
        oxygenSaturation,
        heartRate,
      },
      heartRate,
      oxygenSaturation,
      capturedById: session.userId,
      source: "hardware-api",
    })
    .returning({ id: deviceReadingsTable.id });

  await logActivity({
    userId: session.userId,
    module: "dispositivos",
    action: "usb-oximetro",
    recordId: reading.id,
    detail: `SpO2 ${oxygenSaturation} FC ${heartRate}`,
  });

  revalidatePath(`/dispositivos/${input.medicalDeviceId}`);
  if (input.patientId) revalidatePath(`/pacientes/${input.patientId}`);
  redirect(`/dispositivos/${input.medicalDeviceId}?reading=1`);
}
