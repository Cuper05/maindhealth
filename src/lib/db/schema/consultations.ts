import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { appointmentsTable } from "./appointments";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const consultationsTable = pgTable("consultations", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id")
    .notNull()
    .references(() => appointmentsTable.id),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id),
  doctorId: integer("doctor_id")
    .notNull()
    .references(() => usersTable.id),
  reason: text("reason"),
  currentIllness: text("current_illness"),
  physicalExam: text("physical_exam"),
  diagnosis: text("diagnosis"),
  treatmentPlan: text("treatment_plan"),
  instructions: text("instructions"),
  clinicalSummary: text("clinical_summary"),
  consultedAt: timestamp("consulted_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
