import { z } from "zod";

export const patientSchema = z.object({
  firstName: z.string().min(1, "Nombre requerido"),
  lastNamePaternal: z.string().min(1, "Apellido paterno requerido"),
  lastNameMaternal: z.string().optional(),
  birthDate: z.string().optional(),
  sex: z.string().optional(),
  curp: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  allergies: z.string().optional(),
  chronicConditions: z.string().optional(),
  currentMedications: z.string().optional(),
});

export const clinicalRecordSchema = z.object({
  allergies: z.string().optional(),
  familyHistory: z.string().optional(),
  pathologicalHistory: z.string().optional(),
  nonPathologicalHistory: z.string().optional(),
  previousSurgeries: z.string().optional(),
  chronicConditions: z.string().optional(),
  currentMedications: z.string().optional(),
  generalNotes: z.string().optional(),
});

export function parsePatientForm(formData: FormData) {
  return patientSchema.safeParse({
    firstName: formData.get("firstName"),
    lastNamePaternal: formData.get("lastNamePaternal"),
    lastNameMaternal: formData.get("lastNameMaternal") || undefined,
    birthDate: formData.get("birthDate") || undefined,
    sex: formData.get("sex") || undefined,
    curp: formData.get("curp") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    address: formData.get("address") || undefined,
    emergencyContactName: formData.get("emergencyContactName") || undefined,
    emergencyContactPhone: formData.get("emergencyContactPhone") || undefined,
    allergies: formData.get("allergies") || undefined,
    chronicConditions: formData.get("chronicConditions") || undefined,
    currentMedications: formData.get("currentMedications") || undefined,
  });
}

export function parseClinicalRecordForm(formData: FormData) {
  return clinicalRecordSchema.safeParse({
    allergies: formData.get("allergies") || undefined,
    familyHistory: formData.get("familyHistory") || undefined,
    pathologicalHistory: formData.get("pathologicalHistory") || undefined,
    nonPathologicalHistory: formData.get("nonPathologicalHistory") || undefined,
    previousSurgeries: formData.get("previousSurgeries") || undefined,
    chronicConditions: formData.get("chronicConditions") || undefined,
    currentMedications: formData.get("currentMedications") || undefined,
    generalNotes: formData.get("generalNotes") || undefined,
  });
}
