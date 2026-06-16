import {
  date,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const patientsTable = pgTable("patients", {
  id: serial("id").primaryKey(),
  chartNumber: varchar("chart_number", { length: 50 }).notNull().unique(),
  firstName: varchar("first_name", { length: 150 }).notNull(),
  lastNamePaternal: varchar("last_name_paternal", { length: 150 }).notNull(),
  lastNameMaternal: varchar("last_name_maternal", { length: 150 }),
  birthDate: date("birth_date"),
  sex: varchar("sex", { length: 30 }),
  curp: varchar("curp", { length: 30 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 200 }),
  address: text("address"),
  emergencyContactName: varchar("emergency_contact_name", { length: 200 }),
  emergencyContactPhone: varchar("emergency_contact_phone", { length: 50 }),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  registeredAt: timestamp("registered_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
