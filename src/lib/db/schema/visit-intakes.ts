import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { appointmentsTable } from "./appointments";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const SMOKING_STATUSES = ["never", "former", "current"] as const;
export type SmokingStatus = (typeof SMOKING_STATUSES)[number];

export const SMOKING_STATUS_LABELS: Record<SmokingStatus, string> = {
  never: "Nunca",
  former: "Ex fumador",
  current: "Fumador activo",
};

export const ALCOHOL_USE_LEVELS = ["none", "occasional", "frequent"] as const;
export type AlcoholUseLevel = (typeof ALCOHOL_USE_LEVELS)[number];

export const ALCOHOL_USE_LABELS: Record<AlcoholUseLevel, string> = {
  none: "No consume",
  occasional: "Ocasional",
  frequent: "Frecuente",
};

export const visitIntakesTable = pgTable("visit_intakes", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id")
    .notNull()
    .unique()
    .references(() => appointmentsTable.id),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id),
  completedByUserId: integer("completed_by_user_id").references(() => usersTable.id),
  chiefComplaint: text("chief_complaint").notNull(),
  /** Selección estructurada de síntomas del kiosco (códigos, intensidad, duración). */
  symptomSelection: jsonb("symptom_selection"),
  /** Copia completa del borrador clínico de estación al momento del consentimiento. */
  clinicalSnapshot: jsonb("clinical_snapshot"),
  hasDiabetes: boolean("has_diabetes").notNull().default(false),
  diabetesDetails: text("diabetes_details"),
  hasHypertension: boolean("has_hypertension").notNull().default(false),
  hypertensionDetails: text("hypertension_details"),
  hasAsthma: boolean("has_asthma").notNull().default(false),
  hasHeartDisease: boolean("has_heart_disease").notNull().default(false),
  heartDiseaseDetails: text("heart_disease_details"),
  hasAllergies: boolean("has_allergies").notNull().default(false),
  allergyDetails: text("allergy_details"),
  hasSurgeries: boolean("has_surgeries").notNull().default(false),
  surgeryDetails: text("surgery_details"),
  otherChronicConditions: text("other_chronic_conditions"),
  currentMedications: text("current_medications"),
  smokingStatus: varchar("smoking_status", { length: 20 }).notNull().default("never"),
  alcoholUse: varchar("alcohol_use", { length: 20 }).notNull().default("none"),
  changesSinceLastVisit: text("changes_since_last_visit"),
  additionalNotes: text("additional_notes"),
  patientType: varchar("patient_type", { length: 20 }).notNull().default("returning"),
  source: varchar("source", { length: 30 }).notNull().default("kiosk"),
  dataConfirmedAt: timestamp("data_confirmed_at"),
  consentSignerName: varchar("consent_signer_name", { length: 200 }),
  consentAcceptedAt: timestamp("consent_accepted_at"),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
