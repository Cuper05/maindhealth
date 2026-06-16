import {
  boolean,
  pgTable,
  serial,
  text,
  varchar,
} from "drizzle-orm/pg-core";

export const catalogAppointmentTypesTable = pgTable("catalog_appointment_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
});

export const catalogAppointmentStatusesTable = pgTable(
  "catalog_appointment_statuses",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 50 }).notNull().unique(),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
  },
);
