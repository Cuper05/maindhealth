import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { consultationsTable } from "./consultations";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const followUpsTable = pgTable("follow_ups", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id),
  consultationId: integer("consultation_id").references(
    () => consultationsTable.id,
  ),
  doctorId: integer("doctor_id")
    .notNull()
    .references(() => usersTable.id),
  followUpAt: timestamp("follow_up_at").notNull().defaultNow(),
  evolution: text("evolution"),
  notes: text("notes"),
  nextReviewAt: timestamp("next_review_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
