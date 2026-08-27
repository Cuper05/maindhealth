import {
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { appointmentsTable } from "./appointments";
import { patientsTable } from "./patients";
import { vitalSignsTable } from "./vital-signs";

export const KIOSK_STEPS = [
  "welcome",
  "service",
  "payment",
  "identification",
  "registration",
  "symptoms",
  "antecedents",
  "consent",
  /** Legacy sessions may still store clinical */
  "clinical",
  "preparation",
  "weight_height",
  "blood_pressure",
  "oxygen",
  "temperature",
  "ecg",
  "summary",
  "analysis",
  "result",
  "waiting",
  "consultation",
] as const;

export type KioskStep = (typeof KIOSK_STEPS)[number];

export const KIOSK_STEP_LABELS: Record<KioskStep, string> = {
  welcome: "Bienvenida",
  service: "Servicio",
  payment: "Pago",
  identification: "Identificación",
  registration: "Datos del paciente",
  symptoms: "Síntomas",
  antecedents: "Antecedentes",
  consent: "Consentimiento",
  clinical: "Formulario clínico",
  preparation: "Preparación",
  weight_height: "Peso y altura",
  blood_pressure: "Presión arterial",
  oxygen: "Oxigenación y pulso",
  temperature: "Temperatura",
  ecg: "Electrocardiograma",
  summary: "Resumen",
  analysis: "Revisión médica",
  result: "Resultado",
  waiting: "Espera médico",
  /** Legacy step: video runs on Dell `/estacion/sala`, not on the touch kiosk. */
  consultation: "Espera (pantalla principal)",
};

export type KioskAssessmentDraft = {
  diagnosis: string;
  severity: "low" | "moderate" | "high" | "critical";
  requiresDoctor: boolean;
  summary: string;
  treatmentPlan: string;
  instructions: string;
  redFlags: string[];
  medications: Array<{
    medication: string;
    dose?: string;
    frequency?: string;
    duration?: string;
    route?: string;
    instructions?: string;
  }>;
  engine: "rules" | "openai";
  protocolCode?: string | null;
  protocolName?: string | null;
  prescriptionAuthorized?: boolean;
  responsibleDoctorName?: string | null;
  responsibleDoctorLicense?: string | null;
  consultationId?: number | null;
  prescriptionId?: number | null;
  prescriptionFolio?: string | null;
  /** Receta firmada por el médico → estación debe imprimir automáticamente. */
  printPending?: boolean;
  printRequestedAt?: string | null;
  printCompletedAt?: string | null;
  printError?: string | null;
  /** Visible when Daily room creation failed during escalation. */
  roomError?: string | null;
  /** Receta enviada por correo al paciente. */
  prescriptionEmailSentAt?: string | null;
  prescriptionEmailTo?: string | null;
  prescriptionEmailId?: string | null;
};

export type KioskVitalsDraft = {
  systolicPressure?: string;
  diastolicPressure?: string;
  heartRate?: string;
  oxygenSaturation?: string;
  temperature?: string;
  weight?: string;
  height?: string;
  bmi?: string;
  /** done | skipped — ECG hardware may still be pending */
  ecgStatus?: string;
  ecgRhythm?: string;
  ecgHeartRate?: string;
};

export type KioskDeviceStatus = "idle" | "waiting" | "reading" | "done" | "retry";

export const stationKioskSessionsTable = pgTable("station_kiosk_sessions", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  currentStep: varchar("current_step", { length: 40 }).notNull().default("welcome"),
  patientId: integer("patient_id").references(() => patientsTable.id),
  appointmentId: integer("appointment_id").references(() => appointmentsTable.id),
  serviceId: integer("service_id"),
  paymentOrderId: integer("payment_order_id"),
  paymentStatus: varchar("payment_status", { length: 20 }).notNull().default("unpaid"),
  patientType: varchar("patient_type", { length: 20 }),
  deviceStatus: varchar("device_status", { length: 20 }).notNull().default("idle"),
  vitalsDraft: jsonb("vitals_draft").$type<KioskVitalsDraft>(),
  clinicalDraft: jsonb("clinical_draft"),
  assessmentDraft: jsonb("assessment_draft").$type<KioskAssessmentDraft>(),
  vitalSignId: integer("vital_sign_id").references(() => vitalSignsTable.id),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
