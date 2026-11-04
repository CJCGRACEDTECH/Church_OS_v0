import { boolean, customType, date, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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
  isVisitor: boolean("is_visitor").notNull().default(false),
  hasSpecialNeeds: boolean("has_special_needs").notNull().default(false),
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

export const childrenClassroomsTable = pgTable("children_classrooms", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  name: text("name").notNull(),
  minAgeYears: integer("min_age_years"),
  maxAgeYears: integer("max_age_years"),
  isSpecialNeeds: boolean("is_special_needs").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("children_classrooms_church_name_idx").on(table.churchId, table.name),
]);

export const childIncidentsTable = pgTable("child_incidents", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  childId: integer("child_id").notNull().references(() => childrenTable.id),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  classroom: text("classroom"),
  description: text("description").notNull(),
  actionTaken: text("action_taken"),
  reportedByUserId: integer("reported_by_user_id").notNull().references(() => usersTable.id),
  status: text("status", { enum: ["open", "resolved"] }).notNull().default("open"),
  resolutionNotes: text("resolution_notes"),
  resolvedByUserId: integer("resolved_by_user_id").references(() => usersTable.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("child_incidents_child_idx").on(table.childId),
]);

export const childPermissionSlipsTable = pgTable("child_permission_slips", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  title: text("title").notNull(),
  eventDate: date("event_date"),
  notes: text("notes"),
  createdByUserId: integer("created_by_user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

const bytea = customType<{ data: Buffer }>({
  dataType: () => "bytea",
});

export const CHILD_DOCUMENT_CATEGORIES = [
  "medication_consent",
  "photo_consent",
  "event_permission",
  "medical",
  "other",
] as const;

export const childDocumentsTable = pgTable("child_documents", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  childId: integer("child_id").notNull().references(() => childrenTable.id),
  category: text("category", { enum: CHILD_DOCUMENT_CATEGORIES }).notNull(),
  title: text("title").notNull(),
  permissionSlipId: integer("permission_slip_id").references(() => childPermissionSlipsTable.id),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  fileData: bytea("file_data").notNull(),
  uploadedByUserId: integer("uploaded_by_user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("child_documents_child_idx").on(table.childId),
]);

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
export type ChildrenClassroom = typeof childrenClassroomsTable.$inferSelect;
export type ChildIncident = typeof childIncidentsTable.$inferSelect;
export type ChildPermissionSlip = typeof childPermissionSlipsTable.$inferSelect;
export type ChildDocument = typeof childDocumentsTable.$inferSelect;
export type ChildDocumentCategory = (typeof CHILD_DOCUMENT_CATEGORIES)[number];
