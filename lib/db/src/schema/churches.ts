import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const churchesTable = pgTable("churches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertChurchSchema = createInsertSchema(churchesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertChurch = z.infer<typeof insertChurchSchema>;
export type Church = typeof churchesTable.$inferSelect;
