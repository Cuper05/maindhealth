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
import { consultationsTable } from "./consultations";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const LAB_RESULT_STATUSES = ["pending", "completed", "reviewed"] as const;
export type LabResultStatus = (typeof LAB_RESULT_STATUSES)[number];

export const LAB_RESULT_STATUS_LABELS: Record<LabResultStatus, string> = {
  pending: "Pendiente",
  completed: "Completado",
  reviewed: "Revisado",
};

export const labResultsTable = pgTable("lab_results", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id),
  consultationId: integer("consultation_id").references(() => consultationsTable.id),
  appointmentId: integer("appointment_id").references(() => appointmentsTable.id),
  testName: varchar("test_name", { length: 200 }).notNull(),
  testCode: varchar("test_code", { length: 50 }),
  results: jsonb("results").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("completed"),
  resultAt: timestamp("result_at").notNull().defaultNow(),
  notes: text("notes"),
  uploadedById: integer("uploaded_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
