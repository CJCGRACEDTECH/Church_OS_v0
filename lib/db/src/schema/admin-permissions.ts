import { integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const adminPermissionsTable = pgTable(
  "admin_permissions",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => usersTable.id),
    permission: text("permission").notNull(),
    grantedByUserId: integer("granted_by_user_id").references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("admin_permissions_user_permission_idx").on(table.userId, table.permission),
  ],
);

export const insertAdminPermissionSchema = createInsertSchema(adminPermissionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAdminPermission = z.infer<typeof insertAdminPermissionSchema>;
export type AdminPermission = typeof adminPermissionsTable.$inferSelect;
