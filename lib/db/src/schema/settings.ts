import { integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { churchesTable } from "./churches";
import { usersTable } from "./users";

export const churchProfileSettingsTable = pgTable("church_profile_settings", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  churchName: text("church_name").notNull(),
  churchLogoUrl: text("church_logo_url"),
  churchAddress: text("church_address"),
  churchPhoneNumber: text("church_phone_number"),
  churchEmail: text("church_email"),
  websiteUrl: text("website_url"),
  churchEin: text("church_ein"),
  timezone: text("timezone").notNull().default("America/New_York"),
  defaultLanguage: text("default_language").notNull().default("English"),
  youtubeUrl: text("youtube_url"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  defaultZoomLink: text("default_zoom_link"),
  updatedByUserId: integer("updated_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  churchUnique: uniqueIndex("church_profile_settings_church_id_idx").on(table.churchId),
}));

export const systemSettingsTable = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  settingGroup: text("setting_group").notNull(),
  settings: jsonb("settings").notNull().default({}),
  updatedByUserId: integer("updated_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  churchGroupUnique: uniqueIndex("system_settings_church_group_idx").on(table.churchId, table.settingGroup),
}));

export const insertChurchProfileSettingsSchema = createInsertSchema(churchProfileSettingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSystemSettingsSchema = createInsertSchema(systemSettingsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type ChurchProfileSettings = typeof churchProfileSettingsTable.$inferSelect;
export type SystemSettings = typeof systemSettingsTable.$inferSelect;
export type InsertChurchProfileSettings = z.infer<typeof insertChurchProfileSettingsSchema>;
export type InsertSystemSettings = z.infer<typeof insertSystemSettingsSchema>;

