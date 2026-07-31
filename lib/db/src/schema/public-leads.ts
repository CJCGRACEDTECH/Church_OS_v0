import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { churchesTable } from "./churches";

/**
 * Stores public form submissions that cannot be linked to a known same-church
 * member — e.g. submissions from an email already registered in a different
 * church tenant.  No FK to usersTable, so there is no cross-tenant PII
 * association.
 */
export const publicFormLeadsTable = pgTable("public_form_leads", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  requestType: text("request_type").notNull(), // "connect_form" | "account_request"
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phoneNumber: text("phone_number"),
  message: text("message"),
  status: text("status", { enum: ["submitted", "reviewed", "archived"] }).notNull().default("submitted"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type PublicFormLead = typeof publicFormLeadsTable.$inferSelect;
export type InsertPublicFormLead = typeof publicFormLeadsTable.$inferInsert;
