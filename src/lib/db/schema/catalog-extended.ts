import {
  boolean,
  pgTable,
  serial,
  text,
  varchar,
} from "drizzle-orm/pg-core";

export const catalogSymptomsTable = pgTable("catalog_symptoms", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  category: varchar("category", { length: 100 }),
  description: text("description"),
  active: boolean("active").notNull().default(true),
});

export const catalogDiagnosesTable = pgTable("catalog_diagnoses", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
});

export const catalogMedicationsTable = pgTable("catalog_medications", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  genericName: varchar("generic_name", { length: 150 }),
  form: varchar("form", { length: 80 }),
  strength: varchar("strength", { length: 80 }),
  description: text("description"),
  active: boolean("active").notNull().default(true),
});
