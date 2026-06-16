import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";

export const clinicalRecordsTable = pgTable("clinical_records", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .unique()
    .references(() => patientsTable.id),
  allergies: text("allergies"),
  familyHistory: text("family_history"),
  pathologicalHistory: text("pathological_history"),
  nonPathologicalHistory: text("non_pathological_history"),
  previousSurgeries: text("previous_surgeries"),
  chronicConditions: text("chronic_conditions"),
  currentMedications: text("current_medications"),
  generalNotes: text("general_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
