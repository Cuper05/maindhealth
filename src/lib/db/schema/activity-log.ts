import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id),
  module: varchar("module", { length: 100 }).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  recordId: integer("record_id"),
  detail: text("detail"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ACTIVITY_MODULES = [
  "auth",
  "configuracion",
  "pacientes",
  "expediente",
  "agenda",
  "triage",
  "consultas",
  "recetas",
  "seguimientos",
  "documentos",
  "dispositivos",
] as const;

export type ActivityModule = (typeof ACTIVITY_MODULES)[number];

export const ACTIVITY_MODULE_LABELS: Record<ActivityModule, string> = {
  auth: "Autenticación",
  configuracion: "Configuración",
  pacientes: "Pacientes",
  expediente: "Expediente clínico",
  agenda: "Agenda",
  triage: "Triage",
  consultas: "Consultas",
  recetas: "Recetas",
  seguimientos: "Seguimientos",
  documentos: "Documentos",
  dispositivos: "Dispositivos",
};

export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  login: "Inicio de sesión",
  crear: "Crear",
  actualizar: "Actualizar",
  activar: "Activar",
  desactivar: "Desactivar",
  mantenimiento: "Mantenimiento",
  emitir: "Emitir",
  cargar: "Cargar",
};
