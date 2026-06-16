import { z } from "zod";

export const appointmentSchema = z.object({
  patientId: z.coerce.number().int().positive("Selecciona un paciente"),
  doctorId: z.coerce.number().int().positive("Selecciona un médico"),
  appointmentTypeId: z.coerce.number().int().positive().optional(),
  modality: z.enum(["teleconsulta", "presencial", "seguimiento"]),
  startAt: z.string().min(1, "Fecha y hora requeridas"),
  endAt: z.string().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  meetingUrl: z.string().url("URL inválida").optional().or(z.literal("")),
});

export function parseAppointmentForm(formData: FormData) {
  const typeRaw = formData.get("appointmentTypeId");
  return appointmentSchema.safeParse({
    patientId: formData.get("patientId"),
    doctorId: formData.get("doctorId"),
    appointmentTypeId: typeRaw ? Number(typeRaw) : undefined,
    modality: formData.get("modality"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt") || undefined,
    reason: formData.get("reason") || undefined,
    notes: formData.get("notes") || undefined,
    meetingUrl: formData.get("meetingUrl") || undefined,
  });
}
