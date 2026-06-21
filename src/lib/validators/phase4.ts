import { z } from "zod";

export const messageSchema = z.object({
  patientId: z.coerce.number().int().positive().optional(),
  body: z.string().min(1, "Escribe un mensaje").max(2000),
});

export function parseMessageForm(formData: FormData) {
  const patientIdRaw = formData.get("patientId");
  return messageSchema.safeParse({
    patientId: patientIdRaw ? Number(patientIdRaw) : undefined,
    body: formData.get("body"),
  });
}

export const deviceIngestSchema = z.object({
  medicalDeviceId: z.coerce.number().int().positive().optional(),
  serialNumber: z.string().optional(),
  patientId: z.coerce.number().int().positive().optional(),
  appointmentId: z.coerce.number().int().positive().optional(),
  systolicPressure: z.string().optional(),
  diastolicPressure: z.string().optional(),
  heartRate: z.string().optional(),
  oxygenSaturation: z.string().optional(),
  temperature: z.string().optional(),
  weight: z.string().optional(),
  glucose: z.string().optional(),
  syncToVitals: z.boolean().optional(),
});
