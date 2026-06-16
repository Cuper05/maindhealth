import {
  boolean,
  pgTable,
  serial,
  text,
  varchar,
} from "drizzle-orm/pg-core";

export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
});
