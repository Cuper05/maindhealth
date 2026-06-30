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
  "identification",
  "registration",
  "clinical",
  "preparation",
  "blood_pressure",
  "oxygen",
  "weight_height",
  "temperature",
  "summary",
  "waiting",
  "consultation",
] as const;

export type KioskStep = (typeof KIOSK_STEPS)[number];

export const KIOSK_STEP_LABELS: Record<KioskStep, string> = {
  welcome: "Bienvenida",
  identification: "Identificación",
  registration: "Datos del paciente",
  clinical: "Formulario clínico",
  preparation: "Preparación",
  blood_pressure: "Presión arterial",
  oxygen: "Oxigenación y pulso",
  weight_height: "Peso y altura",
  temperature: "Temperatura",
  summary: "Resumen",
  waiting: "Espera",
  consultation: "Teleconsulta",
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
};

export type KioskDeviceStatus = "idle" | "waiting" | "reading" | "done" | "retry";

export const stationKioskSessionsTable = pgTable("station_kiosk_sessions", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 64 }).notNull().unique(),
  currentStep: varchar("current_step", { length: 40 }).notNull().default("welcome"),
  patientId: integer("patient_id").references(() => patientsTable.id),
  appointmentId: integer("appointment_id").references(() => appointmentsTable.id),
  patientType: varchar("patient_type", { length: 20 }),
  deviceStatus: varchar("device_status", { length: 20 }).notNull().default("idle"),
  vitalsDraft: jsonb("vitals_draft").$type<KioskVitalsDraft>(),
  clinicalDraft: jsonb("clinical_draft"),
  vitalSignId: integer("vital_sign_id").references(() => vitalSignsTable.id),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
