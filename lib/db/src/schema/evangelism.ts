import { index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { churchesTable } from "./churches";
import { usersTable } from "./users";

export const outreachEventsTable = pgTable(
  "outreach_events",
  {
    id: serial("id").primaryKey(),
    churchId: integer("church_id").notNull().references(() => churchesTable.id),
    eventName: text("event_name").notNull(),
    eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
    location: text("location"),
    notes: text("notes"),
    publicToken: text("public_token").notNull(),
    createdByUserId: integer("created_by_user_id").references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    churchDateIdx: index("outreach_events_church_date_idx").on(table.churchId, table.eventDate),
    publicTokenIdx: uniqueIndex("outreach_events_public_token_idx").on(table.publicToken),
  }),
);

export const outreachContactsTable = pgTable(
  "outreach_contacts",
  {
    id: serial("id").primaryKey(),
    churchId: integer("church_id").notNull().references(() => churchesTable.id),
    outreachEventId: integer("outreach_event_id").notNull().references(() => outreachEventsTable.id),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    phoneNumber: text("phone_number").notNull(),
    email: text("email"),
    notes: text("notes"),
    contactConsent: text("contact_consent", { enum: ["agreed"] }).notNull().default("agreed"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    eventSubmittedIdx: index("outreach_contacts_event_submitted_idx").on(table.outreachEventId, table.submittedAt),
    churchSubmittedIdx: index("outreach_contacts_church_submitted_idx").on(table.churchId, table.submittedAt),
  }),
);

export const insertOutreachEventSchema = createInsertSchema(outreachEventsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOutreachContactSchema = createInsertSchema(outreachContactsTable).omit({ id: true, submittedAt: true });

export type OutreachEvent = typeof outreachEventsTable.$inferSelect;
export type InsertOutreachEvent = z.infer<typeof insertOutreachEventSchema>;
export type OutreachContact = typeof outreachContactsTable.$inferSelect;
export type InsertOutreachContact = z.infer<typeof insertOutreachContactSchema>;
