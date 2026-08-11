import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { appointmentsTable } from "./appointments";
import { usersTable } from "./users";

export const TELECONSULTA_ESCALATION_STATUSES = [
  "active",
  "joined",
  "exhausted",
  "cancelled",
] as const;
export type TeleconsultaEscalationStatus =
  (typeof TELECONSULTA_ESCALATION_STATUSES)[number];

export const TELECONSULTA_ATTEMPT_STATUSES = [
  "pending",
  "joined",
  "timed_out",
  "failed",
] as const;
export type TeleconsultaAttemptStatus =
  (typeof TELECONSULTA_ATTEMPT_STATUSES)[number];

/** Opaque deep-link tokens: /t/{token} → video without login. */
export const teleconsultaJoinTokensTable = pgTable(
  "teleconsulta_join_tokens",
  {
    id: serial("id").primaryKey(),
    token: varchar("token", { length: 64 }).notNull(),
    appointmentId: integer("appointment_id")
      .notNull()
      .references(() => appointmentsTable.id),
    /** Intended doctor; null = any staff with the link. */
    userId: integer("user_id").references(() => usersTable.id),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique("teleconsulta_join_tokens_token_unique").on(table.token)],
);

/** One active escalation pipeline per appointment. */
export const teleconsultaEscalationsTable = pgTable(
  "teleconsulta_escalations",
  {
    id: serial("id").primaryKey(),
    appointmentId: integer("appointment_id")
      .notNull()
      .references(() => appointmentsTable.id),
    currentDoctorUserId: integer("current_doctor_user_id").references(
      () => usersTable.id,
    ),
    /** Ordered doctor user ids (JSON array of numbers). */
    queueJson: text("queue_json").notNull(),
    indexInQueue: integer("index_in_queue").notNull().default(0),
    nextActionAt: timestamp("next_action_at"),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    joinedByUserId: integer("joined_by_user_id").references(() => usersTable.id),
    joinedAt: timestamp("joined_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("teleconsulta_escalations_appointment_unique").on(table.appointmentId),
  ],
);

/** Per-doctor alert attempt (voice + SMS + WhatsApp). */
export const teleconsultaAlertAttemptsTable = pgTable(
  "teleconsulta_alert_attempts",
  {
    id: serial("id").primaryKey(),
    escalationId: integer("escalation_id")
      .notNull()
      .references(() => teleconsultaEscalationsTable.id),
    appointmentId: integer("appointment_id")
      .notNull()
      .references(() => appointmentsTable.id),
    doctorUserId: integer("doctor_user_id")
      .notNull()
      .references(() => usersTable.id),
    joinTokenId: integer("join_token_id").references(
      () => teleconsultaJoinTokensTable.id,
    ),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    channels: varchar("channels", { length: 120 }).notNull().default("voice,sms,whatsapp"),
    voiceCallSid: varchar("voice_call_sid", { length: 80 }),
    smsSid: varchar("sms_sid", { length: 80 }),
    whatsappSid: varchar("whatsapp_sid", { length: 80 }),
    errorDetail: text("error_detail"),
    alertedAt: timestamp("alerted_at").defaultNow().notNull(),
    joinedAt: timestamp("joined_at"),
    timedOutAt: timestamp("timed_out"),
  },
);
