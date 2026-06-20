import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const catalogDeviceTypesTable = pgTable("catalog_device_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  category: varchar("category", { length: 50 }).notNull().default("clinico"),
  description: text("description"),
  active: boolean("active").notNull().default(true),
});

export const medicalDevicesTable = pgTable("medical_devices", {
  id: serial("id").primaryKey(),
  deviceTypeId: integer("device_type_id")
    .notNull()
    .references(() => catalogDeviceTypesTable.id),
  brand: varchar("brand", { length: 150 }),
  model: varchar("model", { length: 150 }),
  serialNumber: varchar("serial_number", { length: 150 }),
  registeredAt: date("registered_at").notNull(),
  lastCalibrationAt: date("last_calibration_at"),
  lastMaintenanceAt: date("last_maintenance_at"),
  status: varchar("status", { length: 50 }).notNull().default("activo"),
  location: varchar("location", { length: 150 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const DEVICE_STATUSES = [
  "activo",
  "en_mantenimiento",
  "calibracion_pendiente",
  "baja",
] as const;

export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  activo: "Activo",
  en_mantenimiento: "En mantenimiento",
  calibracion_pendiente: "Calibración pendiente",
  baja: "Baja",
};

export const DEVICE_CATEGORY_LABELS: Record<string, string> = {
  clinico: "Clínico",
  tecnologico: "Tecnológico",
  soporte: "Soporte operativo",
};
