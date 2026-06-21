import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const clinicalMessagesTable = pgTable("clinical_messages", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id),
  senderUserId: integer("sender_user_id")
    .notNull()
    .references(() => usersTable.id),
  senderRole: varchar("sender_role", { length: 30 }).notNull(),
  body: text("body").notNull(),
  readByPatientAt: timestamp("read_by_patient_at"),
  readByStaffAt: timestamp("read_by_staff_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
