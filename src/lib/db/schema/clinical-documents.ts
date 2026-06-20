import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { consultationsTable } from "./consultations";
import { patientsTable } from "./patients";
import { usersTable } from "./users";

export const catalogDocumentTypesTable = pgTable("catalog_document_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
});

export const clinicalDocumentsTable = pgTable("clinical_documents", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id")
    .notNull()
    .references(() => patientsTable.id),
  consultationId: integer("consultation_id").references(
    () => consultationsTable.id,
  ),
  documentTypeId: integer("document_type_id")
    .notNull()
    .references(() => catalogDocumentTypesTable.id),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  storagePath: text("storage_path").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  fileSize: integer("file_size").notNull(),
  notes: text("notes"),
  uploadedById: integer("uploaded_by_id")
    .notNull()
    .references(() => usersTable.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});
