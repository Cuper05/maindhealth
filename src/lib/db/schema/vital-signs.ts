import {
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { appointmentsTable } from "./appointments";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

/** Extras de dispositivos de estación (ECG, etc.) ligados al registro de signos. */
export type VitalDeviceExtras = {
  ecgStatus?: string | null;
  ecgRhythm?: string | null;
  ecgHeartRate?: string | null;
  source?: "kiosk" | "manual" | "device" | null;
};

export const vitalSignsTable = pgTable("vital_signs", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id),
  appointmentId: integer("appointment_id").references(() => appointmentsTable.id),
  capturedById: integer("captured_by_id").references(() => usersTable.id),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  systolicPressure: numeric("systolic_pressure", { precision: 10, scale: 2 }),
  diastolicPressure: numeric("diastolic_pressure", { precision: 10, scale: 2 }),
  heartRate: numeric("heart_rate", { precision: 10, scale: 2 }),
  oxygenSaturation: numeric("oxygen_saturation", { precision: 10, scale: 2 }),
  temperature: numeric("temperature", { precision: 10, scale: 2 }),
  weight: numeric("weight", { precision: 10, scale: 2 }),
  height: numeric("height", { precision: 10, scale: 2 }),
  glucose: numeric("glucose", { precision: 10, scale: 2 }),
  bmi: numeric("bmi", { precision: 10, scale: 2 }),
  symptoms: text("symptoms"),
  /** ECG y otros datos de dispositivos de estación. */
  deviceExtras: jsonb("device_extras").$type<VitalDeviceExtras>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
