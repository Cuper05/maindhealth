import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { appointmentsTable } from "./appointments";
import { medicalDevicesTable } from "./medical-devices";
import { patientsTable } from "./patients";
import { usersTable } from "./users";
import { vitalSignsTable } from "./vital-signs";

export const deviceReadingsTable = pgTable("device_readings", {
  id: serial("id").primaryKey(),
  medicalDeviceId: integer("medical_device_id")
    .notNull()
    .references(() => medicalDevicesTable.id),
  patientId: integer("patient_id").references(() => patientsTable.id),
  appointmentId: integer("appointment_id").references(() => appointmentsTable.id),
  vitalSignId: integer("vital_sign_id").references(() => vitalSignsTable.id),
  rawPayload: jsonb("raw_payload"),
  systolicPressure: varchar("systolic_pressure", { length: 20 }),
  diastolicPressure: varchar("diastolic_pressure", { length: 20 }),
  heartRate: varchar("heart_rate", { length: 20 }),
  oxygenSaturation: varchar("oxygen_saturation", { length: 20 }),
  temperature: varchar("temperature", { length: 20 }),
  weight: varchar("weight", { length: 20 }),
  glucose: varchar("glucose", { length: 20 }),
  source: varchar("source", { length: 50 }).notNull().default("device"),
  notes: text("notes"),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  capturedById: integer("captured_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
