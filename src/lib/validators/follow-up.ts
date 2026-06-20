import { z } from "zod";

export const followUpSchema = z.object({
  patientId: z.coerce.number().int().positive("Selecciona un paciente"),
  consultationId: z.coerce.number().int().positive().optional(),
  doctorId: z.coerce.number().int().positive("Selecciona un médico"),
  followUpAt: z.string().min(1, "Fecha requerida"),
  evolution: z.string().min(1, "Evolución requerida"),
  notes: z.string().optional(),
  nextReviewAt: z.string().optional(),
});

export function parseFollowUpForm(formData: FormData) {
  const consultRaw = formData.get("consultationId");
  return followUpSchema.safeParse({
    patientId: formData.get("patientId"),
    consultationId: consultRaw ? Number(consultRaw) : undefined,
    doctorId: formData.get("doctorId"),
    followUpAt: formData.get("followUpAt"),
    evolution: formData.get("evolution"),
    notes: formData.get("notes") || undefined,
    nextReviewAt: formData.get("nextReviewAt") || undefined,
  });
}
