import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";
import { vitalSignsTable } from "./vital-signs";

export const ALERT_SEVERITIES = ["low", "medium", "high"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
};

export const clinicalAlertsTable = pgTable("clinical_alerts", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id),
  vitalSignId: integer("vital_sign_id").references(() => vitalSignsTable.id),
  severity: varchar("severity", { length: 20 }).notNull(),
  metric: varchar("metric", { length: 80 }).notNull(),
  value: varchar("value", { length: 50 }),
  message: text("message").notNull(),
  source: varchar("source", { length: 50 }).notNull().default("rules"),
  acknowledgedAt: timestamp("acknowledged_at"),
  acknowledgedById: integer("acknowledged_by_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
