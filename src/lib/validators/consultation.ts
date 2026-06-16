import { z } from "zod";

export const consultationSchema = z.object({
  appointmentId: z.coerce.number().int().positive(),
  reason: z.string().optional(),
  currentIllness: z.string().optional(),
  physicalExam: z.string().optional(),
  diagnosis: z.string().min(1, "Diagnóstico requerido"),
  treatmentPlan: z.string().optional(),
  instructions: z.string().optional(),
  clinicalSummary: z.string().optional(),
});

export function parseConsultationForm(formData: FormData) {
  return consultationSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    reason: formData.get("reason") || undefined,
    currentIllness: formData.get("currentIllness") || undefined,
    physicalExam: formData.get("physicalExam") || undefined,
    diagnosis: formData.get("diagnosis"),
    treatmentPlan: formData.get("treatmentPlan") || undefined,
    instructions: formData.get("instructions") || undefined,
    clinicalSummary: formData.get("clinicalSummary") || undefined,
  });
}

const prescriptionItemSchema = z.object({
  medication: z.string().min(1, "Medicamento requerido"),
  dose: z.string().optional(),
  frequency: z.string().optional(),
  duration: z.string().optional(),
  route: z.string().optional(),
  instructions: z.string().optional(),
});

export const prescriptionSchema = z.object({
  consultationId: z.coerce.number().int().positive(),
  generalNotes: z.string().optional(),
  items: z.array(prescriptionItemSchema).min(1, "Agrega al menos un medicamento"),
});

export function parsePrescriptionPayload(data: unknown) {
  return prescriptionSchema.safeParse(data);
}
