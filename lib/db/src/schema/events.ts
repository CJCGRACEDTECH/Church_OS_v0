import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { churchesTable } from "./churches";
import { usersTable } from "./users";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  title: text("title").notNull(),
  eventType: text("event_type", {
    enum: ["service", "discipleship", "bible_study", "prayer", "baptism", "fasting_season", "special_event", "announcement"],
  }).notNull().default("service"),
  description: text("description"),
  startDatetime: timestamp("start_datetime", { withTimezone: true }).notNull(),
  endDatetime: timestamp("end_datetime", { withTimezone: true }).notNull(),
  location: text("location"),
  eventMode: text("event_mode", { enum: ["in_person", "online", "hybrid"] }).notNull().default("in_person"),
  zoomLink: text("zoom_link"),
  youtubeLink: text("youtube_link"),
  posterUrl: text("poster_url"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurrencePattern: text("recurrence_pattern", { enum: ["weekly", "one_time", "custom"] }).notNull().default("one_time"),
  recurrenceDay: integer("recurrence_day"),
  recurrenceTime: text("recurrence_time"),
  visibility: text("visibility", { enum: ["public", "admin_only"] }).notNull().default("public"),
  status: text("status", { enum: ["draft", "published", "cancelled"] }).notNull().default("draft"),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Event = typeof eventsTable.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
