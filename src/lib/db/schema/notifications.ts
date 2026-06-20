import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const NOTIFICATION_TYPES = [
  "cita_proxima",
  "seguimiento_pendiente",
  "triage_pendiente",
  "dispositivo_alerta",
  "sistema",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  cita_proxima: "Cita próxima",
  seguimiento_pendiente: "Seguimiento",
  triage_pendiente: "Triage pendiente",
  dispositivo_alerta: "Dispositivo",
  sistema: "Sistema",
};

export const notificationsTable = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id),
    type: varchar("type", { length: 50 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body"),
    href: varchar("href", { length: 255 }),
    referenceKey: varchar("reference_key", { length: 120 }).notNull(),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique("notifications_user_reference").on(table.userId, table.referenceKey)],
);
