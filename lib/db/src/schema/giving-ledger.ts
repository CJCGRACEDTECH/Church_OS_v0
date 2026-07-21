import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { churchesTable } from "./churches";
import { usersTable } from "./users";
import { donationsTable, GIVING_CATEGORIES, PAYMENT_METHODS } from "./giving";

export const ALIAS_TYPES = [
  "cashapp_handle",
  "venmo_username",
  "paypal_email",
  "zelle_name",
  "zelle_phone",
  "zelle_email",
  "other",
] as const;

export const UNMATCHED_STATUSES = ["pending", "matched", "visitor", "anonymous", "ignored", "duplicate"] as const;

export const IMPORT_SOURCE_TYPES = [
  "zelle_bank",
  "cashapp_csv",
  "venmo_csv",
  "paypal_csv",
  "square_csv",
  "generic_bank",
] as const;

export const AUDIT_ACTIONS = [
  "donation_created_manual",
  "donation_edited",
  "donation_deleted",
  "unmatched_resolved",
  "alias_created",
  "alias_deleted",
  "import_run",
  "intent_cancelled",
  "receipt_generated",
] as const;

export const AUDIT_ENTITY_TYPES = [
  "donation",
  "unmatched_donation",
  "alias",
  "intent",
  "import_batch",
  "tax_receipt",
] as const;

export const importBatchesTable = pgTable("import_batches", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  fileName: text("file_name").notNull(),
  sourceType: text("source_type", { enum: IMPORT_SOURCE_TYPES }).notNull(),
  columnMapping: jsonb("column_mapping"),
  rowCount: integer("row_count").notNull().default(0),
  importedCount: integer("imported_count").notNull().default(0),
  duplicateCount: integer("duplicate_count").notNull().default(0),
  queuedCount: integer("queued_count").notNull().default(0),
  autoMatchedCount: integer("auto_matched_count").notNull().default(0),
  status: text("status", { enum: ["processing", "completed", "failed"] }).notNull().default("processing"),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const unmatchedDonationsTable = pgTable(
  "unmatched_donations",
  {
    id: serial("id").primaryKey(),
    churchId: integer("church_id").notNull().references(() => churchesTable.id),
    paymentMethod: text("payment_method", { enum: PAYMENT_METHODS }).notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    transactionDate: timestamp("transaction_date", { withTimezone: true }).notNull(),
    senderName: text("sender_name"),
    senderEmail: text("sender_email"),
    senderPhone: text("sender_phone"),
    senderHandle: text("sender_handle"),
    memo: text("memo"),
    providerTransactionId: text("provider_transaction_id"),
    dedupeHash: text("dedupe_hash"),
    importBatchId: integer("import_batch_id").references(() => importBatchesTable.id),
    rawDetails: jsonb("raw_details"),
    suggestedMatches: jsonb("suggested_matches"),
    givingCategory: text("giving_category", { enum: GIVING_CATEGORIES }),
    status: text("status", { enum: UNMATCHED_STATUSES }).notNull().default("pending"),
    resolvedDonationId: integer("resolved_donation_id").references(() => donationsTable.id),
    resolvedByUserId: integer("resolved_by_user_id").references(() => usersTable.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("unmatched_donations_provider_txn_uq")
      .on(t.churchId, t.paymentMethod, t.providerTransactionId)
      .where(sql`${t.providerTransactionId} IS NOT NULL`),
    uniqueIndex("unmatched_donations_dedupe_hash_uq")
      .on(t.churchId, t.dedupeHash)
      .where(sql`${t.dedupeHash} IS NOT NULL`),
  ],
);

export const memberPaymentAliasesTable = pgTable(
  "member_payment_aliases",
  {
    id: serial("id").primaryKey(),
    churchId: integer("church_id").notNull().references(() => churchesTable.id),
    memberId: integer("member_id").notNull().references(() => usersTable.id),
    aliasType: text("alias_type", { enum: ALIAS_TYPES }).notNull(),
    aliasValue: text("alias_value").notNull(),
    normalizedValue: text("normalized_value").notNull(),
    verified: boolean("verified").notNull().default(false),
    createdByUserId: integer("created_by_user_id").references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("member_payment_aliases_uq").on(t.churchId, t.aliasType, t.normalizedValue)],
);

export const givingAuditLogTable = pgTable(
  "giving_audit_log",
  {
    id: serial("id").primaryKey(),
    churchId: integer("church_id").notNull().references(() => churchesTable.id),
    actorUserId: integer("actor_user_id").references(() => usersTable.id),
    action: text("action", { enum: AUDIT_ACTIONS }).notNull(),
    entityType: text("entity_type", { enum: AUDIT_ENTITY_TYPES }).notNull(),
    entityId: integer("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("giving_audit_log_entity_idx").on(t.churchId, t.entityType, t.entityId)],
);

export const insertUnmatchedDonationSchema = createInsertSchema(unmatchedDonationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMemberPaymentAliasSchema = createInsertSchema(memberPaymentAliasesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertImportBatchSchema = createInsertSchema(importBatchesTable).omit({ id: true, createdAt: true });
export const insertGivingAuditLogSchema = createInsertSchema(givingAuditLogTable).omit({ id: true, createdAt: true });

export type UnmatchedDonation = typeof unmatchedDonationsTable.$inferSelect;
export type MemberPaymentAlias = typeof memberPaymentAliasesTable.$inferSelect;
export type ImportBatch = typeof importBatchesTable.$inferSelect;
export type GivingAuditLog = typeof givingAuditLogTable.$inferSelect;
export type InsertUnmatchedDonation = z.infer<typeof insertUnmatchedDonationSchema>;
export type InsertMemberPaymentAlias = z.infer<typeof insertMemberPaymentAliasSchema>;
