import { z } from "zod";

const DEVICE_STATUSES = [
  "activo",
  "en_mantenimiento",
  "calibracion_pendiente",
  "baja",
] as const;

export const medicalDeviceSchema = z.object({
  deviceTypeId: z.coerce.number().int().positive("Selecciona un tipo de equipo"),
  brand: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  registeredAt: z.string().optional(),
  lastCalibrationAt: z.string().optional(),
  lastMaintenanceAt: z.string().optional(),
  status: z.enum(DEVICE_STATUSES),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export function parseMedicalDeviceForm(formData: FormData) {
  return medicalDeviceSchema.safeParse({
    deviceTypeId: formData.get("deviceTypeId"),
    brand: formData.get("brand")?.toString() || undefined,
    model: formData.get("model")?.toString() || undefined,
    serialNumber: formData.get("serialNumber")?.toString() || undefined,
    registeredAt: formData.get("registeredAt")?.toString() || undefined,
    lastCalibrationAt: formData.get("lastCalibrationAt")?.toString() || undefined,
    lastMaintenanceAt: formData.get("lastMaintenanceAt")?.toString() || undefined,
    status: formData.get("status"),
    location: formData.get("location")?.toString() || undefined,
    notes: formData.get("notes")?.toString() || undefined,
  });
}

export const deviceMaintenanceSchema = z.object({
  lastCalibrationAt: z.string().optional(),
  lastMaintenanceAt: z.string().optional(),
  status: z.enum(DEVICE_STATUSES),
  notes: z.string().optional(),
});

export function parseDeviceMaintenanceForm(formData: FormData) {
  return deviceMaintenanceSchema.safeParse({
    lastCalibrationAt: formData.get("lastCalibrationAt")?.toString() || undefined,
    lastMaintenanceAt: formData.get("lastMaintenanceAt")?.toString() || undefined,
    status: formData.get("status"),
    notes: formData.get("notes")?.toString() || undefined,
  });
}
