import {
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { appointmentsTable } from "./appointments";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
