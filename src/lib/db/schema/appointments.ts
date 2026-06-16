import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import {
  catalogAppointmentStatusesTable,
  catalogAppointmentTypesTable,
} from "./catalogs";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const appointmentsTable = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id),
  doctorId: integer("doctor_id")
    .notNull()
    .references(() => usersTable.id),
  appointmentTypeId: integer("appointment_type_id").references(
    () => catalogAppointmentTypesTable.id,
  ),
  appointmentStatusId: integer("appointment_status_id")
    .notNull()
    .references(() => catalogAppointmentStatusesTable.id),
  modality: varchar("modality", { length: 50 }).notNull().default("teleconsulta"),
  startAt: timestamp("start_at").notNull(),
  endAt: timestamp("end_at"),
  reason: text("reason"),
  notes: text("notes"),
  meetingUrl: text("meeting_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
