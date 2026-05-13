import { integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { churchesTable } from "./churches";
import { usersTable } from "./users";

export const adminInvitationsTable = pgTable(
  "admin_invitations",
  {
    id: serial("id").primaryKey(),
    churchId: integer("church_id").notNull().references(() => churchesTable.id),
    invitedByUserId: integer("invited_by_user_id").notNull().references(() => usersTable.id),
    acceptedByUserId: integer("accepted_by_user_id").references(() => usersTable.id),
    tokenHash: text("token_hash").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    adminTitle: text("admin_title").notNull(),
    assignedRole: text("assigned_role", { enum: ["minister", "pastor", "super_admin"] }).notNull(),
    assignedMinistry: text("assigned_ministry"),
    assignedPermissions: jsonb("assigned_permissions").$type<string[]>().notNull().default([]),
    status: text("status", { enum: ["pending", "accepted", "expired"] }).notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("admin_invitations_token_hash_idx").on(table.tokenHash),
  ],
);

export const insertAdminInvitationSchema = createInsertSchema(adminInvitationsTable).omit({
  id: true,
  acceptedByUserId: true,
  acceptedAt: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAdminInvitation = z.infer<typeof insertAdminInvitationSchema>;
export type AdminInvitation = typeof adminInvitationsTable.$inferSelect;
