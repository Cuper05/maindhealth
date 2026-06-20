"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  actionError,
  actionSuccess,
  getActionSession,
} from "@/lib/auth/action-session";
import { db } from "@/lib/db";
import { medicalDevicesTable } from "@/lib/db/schema";
import { logActivity } from "@/lib/audit/log-activity";
import {
  parseDeviceMaintenanceForm,
  parseMedicalDeviceForm,
} from "@/lib/validators/medical-device";

function toDateOrNull(value?: string) {
  return value && value.trim() !== "" ? value : null;
}

export async function createMedicalDevice(_prev: unknown, formData: FormData) {
  const session = await getActionSession("config:view");
  if ("error" in session) return actionError(session.error);

  const parsed = parseMedicalDeviceForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;

  const [device] = await db
    .insert(medicalDevicesTable)
    .values({
      deviceTypeId: data.deviceTypeId,
      brand: data.brand,
      model: data.model,
      serialNumber: data.serialNumber,
      registeredAt: toDateOrNull(data.registeredAt) ?? new Date().toISOString().slice(0, 10),
      lastCalibrationAt: toDateOrNull(data.lastCalibrationAt),
      lastMaintenanceAt: toDateOrNull(data.lastMaintenanceAt),
      status: data.status,
      location: data.location,
      notes: data.notes,
    })
    .returning({ id: medicalDevicesTable.id });

  await logActivity({
    userId: session.userId,
    module: "dispositivos",
    action: "crear",
    recordId: device.id,
    detail: data.serialNumber ?? undefined,
  });

  revalidatePath("/dispositivos");
  revalidatePath("/");

  return actionSuccess({ deviceId: device.id });
}

export async function updateMedicalDevice(
  deviceId: number,
  _prev: unknown,
  formData: FormData,
) {
  const session = await getActionSession("config:view");
  if ("error" in session) return actionError(session.error);

  const parsed = parseMedicalDeviceForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;

  await db
    .update(medicalDevicesTable)
    .set({
      deviceTypeId: data.deviceTypeId,
      brand: data.brand,
      model: data.model,
      serialNumber: data.serialNumber,
      registeredAt: toDateOrNull(data.registeredAt) ?? undefined,
      lastCalibrationAt: toDateOrNull(data.lastCalibrationAt),
      lastMaintenanceAt: toDateOrNull(data.lastMaintenanceAt),
      status: data.status,
      location: data.location,
      notes: data.notes,
      updatedAt: new Date(),
    })
    .where(eq(medicalDevicesTable.id, deviceId));

  await logActivity({
    userId: session.userId,
    module: "dispositivos",
    action: "actualizar",
    recordId: deviceId,
  });

  revalidatePath("/dispositivos");
  revalidatePath(`/dispositivos/${deviceId}`);

  return actionSuccess({});
}

export async function updateDeviceMaintenance(
  deviceId: number,
  _prev: unknown,
  formData: FormData,
) {
  const session = await getActionSession("config:view");
  if ("error" in session) return actionError(session.error);

  const parsed = parseDeviceMaintenanceForm(formData);
  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Datos inválidos");
  }

  const data = parsed.data;

  await db
    .update(medicalDevicesTable)
    .set({
      lastCalibrationAt: toDateOrNull(data.lastCalibrationAt),
      lastMaintenanceAt: toDateOrNull(data.lastMaintenanceAt),
      status: data.status,
      notes: data.notes,
      updatedAt: new Date(),
    })
    .where(eq(medicalDevicesTable.id, deviceId));

  await logActivity({
    userId: session.userId,
    module: "dispositivos",
    action: "mantenimiento",
    recordId: deviceId,
    detail: `Estatus: ${data.status}`,
  });

  revalidatePath("/dispositivos");
  revalidatePath(`/dispositivos/${deviceId}`);

  return actionSuccess({});
}
