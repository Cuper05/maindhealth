import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { stationKioskSessionsTable } from "./station-kiosk";

/** Catálogo de servicios cobrables en la estación. */
export const stationServicesTable = pgTable("station_services", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 150 }).notNull(),
  description: text("description"),
  amountCents: integer("amount_cents").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("MXN"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const STATION_PAYMENT_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "refunded",
  "error",
] as const;
export type StationPaymentStatus = (typeof STATION_PAYMENT_STATUSES)[number];

export const STATION_PAYMENT_PROVIDERS = ["nayax", "stripe", "demo"] as const;
export type StationPaymentProvider = (typeof STATION_PAYMENT_PROVIDERS)[number];

/**
 * Orden de pago previa a la sesión clínica.
 * Nayax VPOS Touch se conectará aquí; demo/stripe sirven para Fase 1.
 */
export const stationPaymentOrdersTable = pgTable("station_payment_orders", {
  id: serial("id").primaryKey(),
  reference: varchar("reference", { length: 64 }).notNull().unique(),
  idempotencyKey: varchar("idempotency_key", { length: 160 }).notNull().unique(),
  stationCode: varchar("station_code", { length: 40 }).notNull().default("EST-001"),
  serviceId: integer("service_id")
    .notNull()
    .references(() => stationServicesTable.id),
  sessionId: integer("session_id").references(() => stationKioskSessionsTable.id),
  amountCents: integer("amount_cents").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("MXN"),
  concept: varchar("concept", { length: 200 }).notNull(),
  provider: varchar("provider", { length: 20 }).notNull().default("demo"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  providerReference: varchar("provider_reference", { length: 120 }),
  providerPayload: jsonb("provider_payload"),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Médico que preautoriza el uso de sus datos/cédula en recetas de protocolo. */
export const stationResponsiblePhysiciansTable = pgTable("station_responsible_physicians", {
  id: serial("id").primaryKey(),
  doctorId: integer("doctor_id")
    .notNull()
    .references(() => usersTable.id),
  active: boolean("active").notNull().default(true),
  authorizationNote: text("authorization_note"),
  authorizedAt: timestamp("authorized_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type ProtocolMedication = {
  medication: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  route?: string;
  instructions?: string;
};

/**
 * Protocolos clínicos preautorizados.
 * La IA solo puede emitir receta si el caso hace match con uno de estos.
 */
export const stationClinicalProtocolsTable = pgTable("station_clinical_protocols", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  /** Palabras clave del motivo de consulta para match preliminar. */
  keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
  medications: jsonb("medications").$type<ProtocolMedication[]>().notNull().default([]),
  treatmentPlan: text("treatment_plan"),
  instructions: text("instructions"),
  diagnosisLabel: varchar("diagnosis_label", { length: 200 }),
  authorizedByDoctorId: integer("authorized_by_doctor_id")
    .notNull()
    .references(() => usersTable.id),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
