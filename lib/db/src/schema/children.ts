import { boolean, date, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { churchesTable } from "./churches";
import { usersTable } from "./users";

export const childrenTable = pgTable("children", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dateOfBirth: date("date_of_birth"),
  gender: text("gender"),
  profilePhotoUrl: text("profile_photo_url"),
  allergyInformation: text("allergy_information"),
  medicalNotes: text("medical_notes"),
  specialInstructions: text("special_instructions"),
  classroom: text("classroom"),
  checkinStatus: text("checkin_status", { enum: ["checked_in", "checked_out"] }).notNull().default("checked_out"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const parentGuardiansTable = pgTable("parent_guardians", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  memberId: integer("member_id").references(() => usersTable.id),
  name: text("name").notNull(),
  email: text("email"),
  phoneNumber: text("phone_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const childGuardianRelationshipsTable = pgTable(
  "child_guardian_relationships",
  {
    id: serial("id").primaryKey(),
    childId: integer("child_id").notNull().references(() => childrenTable.id),
    guardianId: integer("guardian_id").notNull().references(() => parentGuardiansTable.id),
    relationship: text("relationship", { enum: ["parent", "guardian", "emergency_contact"] }).notNull(),
    authorizedPickup: boolean("authorized_pickup").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("child_guardian_unique_idx").on(table.childId, table.guardianId),
  ],
);

export const checkinRecordsTable = pgTable("checkin_records", {
  id: serial("id").primaryKey(),
  childId: integer("child_id").notNull().references(() => childrenTable.id),
  checkedInByUserId: integer("checked_in_by_user_id").notNull().references(() => usersTable.id),
  checkedOutByUserId: integer("checked_out_by_user_id").references(() => usersTable.id),
  pickedUpByGuardianId: integer("picked_up_by_guardian_id").references(() => parentGuardiansTable.id),
  checkinTime: timestamp("checkin_time", { withTimezone: true }).notNull().defaultNow(),
  checkoutTime: timestamp("checkout_time", { withTimezone: true }),
  classroom: text("classroom"),
  pickupCode: text("pickup_code").notNull(),
  status: text("status", { enum: ["active", "checked_out"] }).notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertChildSchema = createInsertSchema(childrenTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertParentGuardianSchema = createInsertSchema(parentGuardiansTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChildGuardianRelationshipSchema = createInsertSchema(childGuardianRelationshipsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCheckinRecordSchema = createInsertSchema(checkinRecordsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Child = typeof childrenTable.$inferSelect;
export type InsertChild = z.infer<typeof insertChildSchema>;
export type ParentGuardian = typeof parentGuardiansTable.$inferSelect;
export type InsertParentGuardian = z.infer<typeof insertParentGuardianSchema>;
export type ChildGuardianRelationship = typeof childGuardianRelationshipsTable.$inferSelect;
export type CheckinRecord = typeof checkinRecordsTable.$inferSelect;
