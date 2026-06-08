import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { churchesTable } from "./churches";
import { usersTable } from "./users";

export const householdUpdateRequestsTable = pgTable("household_update_requests", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  memberId: integer("member_id").notNull().references(() => usersTable.id),
  requestType: text("request_type").notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: ["submitted", "reviewing", "completed", "declined"] }).notNull().default("submitted"),
  reviewedByUserId: integer("reviewed_by_user_id").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHouseholdUpdateRequestSchema = createInsertSchema(householdUpdateRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type HouseholdUpdateRequest = typeof householdUpdateRequestsTable.$inferSelect;
export type InsertHouseholdUpdateRequest = z.infer<typeof insertHouseholdUpdateRequestSchema>;
