import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { rolesTable } from "./roles";

import { patientsTable } from "./patients";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id")
    .notNull()
    .references(() => rolesTable.id),
  patientId: integer("patient_id").references(() => patientsTable.id),
  firstName: varchar("first_name", { length: 150 }).notNull(),
  lastNamePaternal: varchar("last_name_paternal", { length: 150 }).notNull(),
  lastNameMaternal: varchar("last_name_maternal", { length: 150 }),
  email: varchar("email", { length: 200 }).notNull().unique(),
  phone: varchar("phone", { length: 50 }),
  specialty: varchar("specialty", { length: 150 }),
  professionalLicense: varchar("professional_license", { length: 100 }),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
