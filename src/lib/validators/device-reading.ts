import { z } from "zod";

export const deviceReadingSchema = z.object({
  medicalDeviceId: z.coerce.number().int().positive(),
  patientId: z.coerce.number().int().positive().optional(),
  appointmentId: z.coerce.number().int().positive().optional(),
  systolicPressure: z.string().optional(),
  diastolicPressure: z.string().optional(),
  heartRate: z.string().optional(),
  oxygenSaturation: z.string().optional(),
  temperature: z.string().optional(),
  weight: z.string().optional(),
  glucose: z.string().optional(),
  notes: z.string().optional(),
  syncToVitals: z.coerce.boolean().optional(),
});

export function parseDeviceReadingForm(formData: FormData) {
  return deviceReadingSchema.safeParse({
    medicalDeviceId: formData.get("medicalDeviceId"),
    patientId: formData.get("patientId") || undefined,
    appointmentId: formData.get("appointmentId") || undefined,
    systolicPressure: formData.get("systolicPressure") || undefined,
    diastolicPressure: formData.get("diastolicPressure") || undefined,
    heartRate: formData.get("heartRate") || undefined,
    oxygenSaturation: formData.get("oxygenSaturation") || undefined,
    temperature: formData.get("temperature") || undefined,
    weight: formData.get("weight") || undefined,
    glucose: formData.get("glucose") || undefined,
    notes: formData.get("notes") || undefined,
    syncToVitals: formData.get("syncToVitals") === "on",
  });
}
