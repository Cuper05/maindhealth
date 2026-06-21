import { integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const SIGNATURE_ENTITY_TYPES = ["prescription", "consultation"] as const;
export type SignatureEntityType = (typeof SIGNATURE_ENTITY_TYPES)[number];

export const digitalSignaturesTable = pgTable("digital_signatures", {
  id: serial("id").primaryKey(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: integer("entity_id").notNull(),
  signedById: integer("signed_by_id")
    .notNull()
    .references(() => usersTable.id),
  signerName: varchar("signer_name", { length: 200 }).notNull(),
  signerLicense: varchar("signer_license", { length: 100 }),
  signatureHash: text("signature_hash").notNull(),
  signedAt: timestamp("signed_at").notNull().defaultNow(),
  metadata: text("metadata"),
});
