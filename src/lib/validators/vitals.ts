import { z } from "zod";

const optionalNumber = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v : undefined));

export const vitalSignsSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  appointmentId: z.coerce.number().int().positive().optional(),
  systolicPressure: optionalNumber,
  diastolicPressure: optionalNumber,
  heartRate: optionalNumber,
  oxygenSaturation: optionalNumber,
  temperature: optionalNumber,
  weight: optionalNumber,
  height: optionalNumber,
  glucose: optionalNumber,
  symptoms: z.string().optional(),
});

export function parseVitalSignsForm(formData: FormData) {
  const apptRaw = formData.get("appointmentId");
  return vitalSignsSchema.safeParse({
    patientId: formData.get("patientId"),
    appointmentId: apptRaw ? Number(apptRaw) : undefined,
    systolicPressure: formData.get("systolicPressure")?.toString(),
    diastolicPressure: formData.get("diastolicPressure")?.toString(),
    heartRate: formData.get("heartRate")?.toString(),
    oxygenSaturation: formData.get("oxygenSaturation")?.toString(),
    temperature: formData.get("temperature")?.toString(),
    weight: formData.get("weight")?.toString(),
    height: formData.get("height")?.toString(),
    glucose: formData.get("glucose")?.toString(),
    symptoms: formData.get("symptoms")?.toString() || undefined,
  });
}

export function computeBmi(weightKg: number, heightCm: number) {
  if (heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 100) / 100;
}
