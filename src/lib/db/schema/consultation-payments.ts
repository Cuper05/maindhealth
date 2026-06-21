import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { appointmentsTable } from "./appointments";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const PAYMENT_METHODS = ["pending", "cash", "card", "transfer", "stripe"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "cancelled", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pending: "Por definir",
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  stripe: "Pago en línea",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

export const consultationPaymentsTable = pgTable("consultation_payments", {
  id: serial("id").primaryKey(),
  appointmentId: integer("appointment_id")
    .notNull()
    .references(() => appointmentsTable.id),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id),
  amountCents: integer("amount_cents").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("MXN"),
  method: varchar("method", { length: 30 }).notNull().default("pending"),
  status: varchar("status", { length: 30 }).notNull().default("pending"),
  reference: varchar("reference", { length: 100 }),
  stripeSessionId: varchar("stripe_session_id", { length: 255 }),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  recordedById: integer("recorded_by_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
