import { pgTable, serial, text, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { churchesTable } from "./churches";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  preferredName: text("preferred_name"),
  phoneNumber: text("phone_number"),
  profilePhotoUrl: text("profile_photo_url"),
  dateOfBirth: date("date_of_birth"),
  gender: text("gender"),
  maritalStatus: text("marital_status"),
  occupation: text("occupation"),
  preferredLanguage: text("preferred_language"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhoneNumber: text("emergency_contact_phone_number"),
  streetAddress: text("street_address"),
  apartmentUnit: text("apartment_unit"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country"),
  role: text("role", { enum: ["admin", "member"] }).notNull().default("member"),
  adminLevel: text("admin_level", { enum: ["super_admin", "pastor", "minister"] }),
  assignedMinistry: text("assigned_ministry"),
  accountStatus: text("account_status", { enum: ["active", "pending", "disabled"] }).notNull().default("active"),
  createdByUserId: integer("created_by_user_id"),
  clerkUserId: text("clerk_user_id").unique(),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
