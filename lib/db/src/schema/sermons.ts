import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { churchesTable } from "./churches";
import { usersTable } from "./users";

export const sermonsTable = pgTable("sermons", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  title: text("title").notNull(),
  speakerName: text("speaker_name"),
  seriesName: text("series_name"),
  description: text("description"),
  youtubeVideoId: text("youtube_video_id").notNull(),
  sermonDate: timestamp("sermon_date", { withTimezone: true }).notNull(),
  isPublished: boolean("is_published").notNull().default(false),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSermonSchema = createInsertSchema(sermonsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Sermon = typeof sermonsTable.$inferSelect;
export type InsertSermon = z.infer<typeof insertSermonSchema>;
