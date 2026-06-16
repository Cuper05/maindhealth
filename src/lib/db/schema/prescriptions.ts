import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { consultationsTable } from "./consultations";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const prescriptionsTable = pgTable("prescriptions", {
  id: serial("id").primaryKey(),
  consultationId: integer("consultation_id")
    .notNull()
    .references(() => consultationsTable.id),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id),
  doctorId: integer("doctor_id")
    .notNull()
    .references(() => usersTable.id),
  issuedAt: timestamp("issued_at").notNull().defaultNow(),
  generalNotes: text("general_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const prescriptionItemsTable = pgTable("prescription_items", {
  id: serial("id").primaryKey(),
  prescriptionId: integer("prescription_id")
    .notNull()
    .references(() => prescriptionsTable.id, { onDelete: "cascade" }),
  medication: varchar("medication", { length: 200 }).notNull(),
  dose: varchar("dose", { length: 100 }),
  frequency: varchar("frequency", { length: 100 }),
  duration: varchar("duration", { length: 100 }),
  route: varchar("route", { length: 100 }),
  instructions: text("instructions"),
});
