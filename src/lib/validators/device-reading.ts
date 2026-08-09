import { z } from "zod";

const vitalFields = [
  "systolicPressure",
  "diastolicPressure",
  "heartRate",
  "oxygenSaturation",
  "temperature",
  "weight",
  "glucose",
] as const;

export const deviceReadingSchema = z
  .object({
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
  })
  .superRefine((data, ctx) => {
    const hasVital = vitalFields.some((key) => {
      const value = data[key];
      return typeof value === "string" && value.trim() !== "";
    });
    if (!hasVital) {
      ctx.addIssue({
        code: "custom",
        message: "Captura al menos un valor (para oxímetro: SpO2 y/o FC).",
        path: ["oxygenSaturation"],
      });
    }
  });

export function parseDeviceReadingForm(formData: FormData) {
  const emptyToUndef = (value: FormDataEntryValue | null) => {
    const text = value?.toString().trim() ?? "";
    return text === "" ? undefined : text;
  };

  return deviceReadingSchema.safeParse({
    medicalDeviceId: formData.get("medicalDeviceId"),
    patientId: emptyToUndef(formData.get("patientId")),
    appointmentId: emptyToUndef(formData.get("appointmentId")),
    systolicPressure: emptyToUndef(formData.get("systolicPressure")),
    diastolicPressure: emptyToUndef(formData.get("diastolicPressure")),
    heartRate: emptyToUndef(formData.get("heartRate")),
    oxygenSaturation: emptyToUndef(formData.get("oxygenSaturation")),
    temperature: emptyToUndef(formData.get("temperature")),
    weight: emptyToUndef(formData.get("weight")),
    glucose: emptyToUndef(formData.get("glucose")),
    notes: emptyToUndef(formData.get("notes")),
    syncToVitals: formData.get("syncToVitals") === "on",
  });
}
