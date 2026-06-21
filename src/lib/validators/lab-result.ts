import { z } from "zod";

export const labResultSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  consultationId: z.coerce.number().int().positive().optional(),
  appointmentId: z.coerce.number().int().positive().optional(),
  testName: z.string().min(1, "Nombre del estudio requerido"),
  testCode: z.string().optional(),
  resultsJson: z.string().min(2, "Resultados requeridos (JSON)"),
  notes: z.string().optional(),
  status: z.enum(["pending", "completed", "reviewed"]).default("completed"),
});

export function parseLabResultForm(formData: FormData) {
  return labResultSchema.safeParse({
    patientId: formData.get("patientId"),
    consultationId: formData.get("consultationId") || undefined,
    appointmentId: formData.get("appointmentId") || undefined,
    testName: formData.get("testName"),
    testCode: formData.get("testCode") || undefined,
    resultsJson: formData.get("resultsJson"),
    notes: formData.get("notes") || undefined,
    status: formData.get("status") || "completed",
  });
}
