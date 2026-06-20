import { z } from "zod";

const optionalText = z
  .string()
  .optional()
  .transform((v) => (v?.trim() ? v.trim() : undefined));

export const symptomSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  category: optionalText,
  description: optionalText,
});

export const diagnosisSchema = z.object({
  code: optionalText,
  name: z.string().min(1, "Nombre requerido"),
  description: optionalText,
});

export const medicationSchema = z.object({
  name: z.string().min(1, "Nombre comercial requerido"),
  genericName: optionalText,
  form: optionalText,
  strength: optionalText,
  description: optionalText,
});

export function parseSymptomForm(formData: FormData) {
  return symptomSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category") || undefined,
    description: formData.get("description") || undefined,
  });
}

export function parseDiagnosisForm(formData: FormData) {
  return diagnosisSchema.safeParse({
    code: formData.get("code") || undefined,
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
}

export function parseMedicationForm(formData: FormData) {
  return medicationSchema.safeParse({
    name: formData.get("name"),
    genericName: formData.get("genericName") || undefined,
    form: formData.get("form") || undefined,
    strength: formData.get("strength") || undefined,
    description: formData.get("description") || undefined,
  });
}
