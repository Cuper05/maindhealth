import { z } from "zod";
import {
  ALCOHOL_USE_LEVELS,
  SMOKING_STATUSES,
} from "@/lib/db/schema/visit-intakes";

function yesNo(value: FormDataEntryValue | null) {
  return value === "yes" || value === "true" || value === "on";
}

export const visitIntakeSchema = z
  .object({
    appointmentId: z.coerce.number().int().positive(),
    chiefComplaint: z.string().min(3, "Describe el motivo de la consulta"),
    symptomSelection: z.unknown().optional(),
    clinicalSnapshot: z.unknown().optional(),
    hasDiabetes: z.boolean(),
    diabetesDetails: z.string().optional(),
    hasHypertension: z.boolean(),
    hypertensionDetails: z.string().optional(),
    hasAsthma: z.boolean().optional(),
    hasHeartDisease: z.boolean(),
    heartDiseaseDetails: z.string().optional(),
    hasAllergies: z.boolean(),
    allergyDetails: z.string().optional(),
    hasSurgeries: z.boolean(),
    surgeryDetails: z.string().optional(),
    otherChronicConditions: z.string().optional(),
    currentMedications: z.string().optional(),
    smokingStatus: z.enum(SMOKING_STATUSES),
    alcoholUse: z.enum(ALCOHOL_USE_LEVELS),
    changesSinceLastVisit: z.string().optional(),
    additionalNotes: z.string().optional(),
    patientType: z.enum(["new", "returning"]),
    consentSignerName: z.string().min(3, "Nombre del paciente o tutor requerido"),
    consentAccepted: z.boolean(),
    source: z.enum(["kiosk", "portal", "staff", "mobile"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.consentAccepted) {
      ctx.addIssue({
        code: "custom",
        message: "Debes aceptar el consentimiento",
        path: ["consentAccepted"],
      });
    }
    if (data.hasDiabetes && !data.diabetesDetails?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Indica detalles de diabetes",
        path: ["diabetesDetails"],
      });
    }
    if (data.hasHypertension && !data.hypertensionDetails?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Indica detalles de hipertensión",
        path: ["hypertensionDetails"],
      });
    }
    if (data.hasHeartDisease && !data.heartDiseaseDetails?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Indica detalles cardíacos",
        path: ["heartDiseaseDetails"],
      });
    }
    if (data.hasAllergies && !data.allergyDetails?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Indica las alergias",
        path: ["allergyDetails"],
      });
    }
    if (data.hasSurgeries && !data.surgeryDetails?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Indica las cirugías previas",
        path: ["surgeryDetails"],
      });
    }
  });

export function parseVisitIntakeForm(formData: FormData) {
  return visitIntakeSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    chiefComplaint: formData.get("chiefComplaint"),
    hasDiabetes: yesNo(formData.get("hasDiabetes")),
    diabetesDetails: formData.get("diabetesDetails") || undefined,
    hasHypertension: yesNo(formData.get("hasHypertension")),
    hypertensionDetails: formData.get("hypertensionDetails") || undefined,
    hasHeartDisease: yesNo(formData.get("hasHeartDisease")),
    heartDiseaseDetails: formData.get("heartDiseaseDetails") || undefined,
    hasAllergies: yesNo(formData.get("hasAllergies")),
    allergyDetails: formData.get("allergyDetails") || undefined,
    hasSurgeries: yesNo(formData.get("hasSurgeries")),
    surgeryDetails: formData.get("surgeryDetails") || undefined,
    otherChronicConditions: formData.get("otherChronicConditions") || undefined,
    currentMedications: formData.get("currentMedications") || undefined,
    smokingStatus: formData.get("smokingStatus") || "never",
    alcoholUse: formData.get("alcoholUse") || "none",
    changesSinceLastVisit: formData.get("changesSinceLastVisit") || undefined,
    additionalNotes: formData.get("additionalNotes") || undefined,
    patientType: formData.get("patientType") || "returning",
    consentSignerName: formData.get("consentSignerName") || "Registro asistido por personal",
    consentAccepted: formData.get("consentAccepted") !== "false",
  });
}

export type VisitIntakeInput = z.infer<typeof visitIntakeSchema>;

export function parseVisitIntakePayload(data: unknown) {
  return visitIntakeSchema.safeParse(data);
}
