import { z } from "zod";

export const portalAppointmentSchema = z.object({
  doctorId: z.coerce.number().int().positive("Selecciona un médico"),
  startAt: z.string().min(1, "Fecha y hora requeridas"),
  reason: z.string().min(3, "Describe el motivo de la consulta"),
  modality: z.enum(["teleconsulta", "presencial", "seguimiento"]).default("teleconsulta"),
});

export function parsePortalAppointmentForm(formData: FormData) {
  return portalAppointmentSchema.safeParse({
    doctorId: formData.get("doctorId"),
    startAt: formData.get("startAt"),
    reason: formData.get("reason"),
    modality: formData.get("modality") || "teleconsulta",
  });
}
