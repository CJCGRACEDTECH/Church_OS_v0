import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { attendanceSessionsTable } from "./attendance";
import { churchesTable } from "./churches";
import { usersTable } from "./users";

export const GIVING_CATEGORIES = ["love_offering", "tithe", "kingdom_commitment", "giftings"] as const;
export const PAYMENT_METHODS = ["stripe", "paypal", "square", "cash_app", "venmo", "zelle", "manual"] as const;
export const PAYMENT_STATUSES = ["pending", "succeeded", "failed", "refunded", "disputed"] as const;
export const INTENT_STATUSES = ["pending", "completed", "failed", "cancelled", "refunded", "expired"] as const;
export const GIVING_FREQUENCIES = ["weekly", "biweekly", "monthly", "yearly"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type GivingCategory = (typeof GIVING_CATEGORIES)[number];

export const givingCampaignsTable = pgTable("giving_campaigns", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  campaignName: text("campaign_name").notNull(),
  description: text("description"),
  goalAmountCents: integer("goal_amount_cents").notNull().default(0),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  status: text("status", { enum: ["draft", "active", "completed", "cancelled"] }).notNull().default("draft"),
  campaignImageUrl: text("campaign_image_url"),
  campaignCategory: text("campaign_category"),
  createdByUserId: integer("created_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const givingIntentsTable = pgTable(
  "giving_intents",
  {
    id: serial("id").primaryKey(),
    churchId: integer("church_id").notNull().references(() => churchesTable.id),
    memberId: integer("member_id").references(() => usersTable.id),
    donorName: text("donor_name"),
    donorEmail: text("donor_email"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    givingCategory: text("giving_category", { enum: GIVING_CATEGORIES }).notNull().default("tithe"),
    campaignId: integer("campaign_id").references(() => givingCampaignsTable.id),
    serviceSessionId: integer("service_session_id").references(() => attendanceSessionsTable.id),
    paymentMethod: text("payment_method", { enum: PAYMENT_METHODS }).notNull(),
    donationType: text("donation_type", { enum: ["one_time", "recurring"] }).notNull().default("one_time"),
    frequency: text("frequency", { enum: GIVING_FREQUENCIES }),
    status: text("status", { enum: INTENT_STATUSES }).notNull().default("pending"),
    providerRef: text("provider_ref"),
    createdByUserId: integer("created_by_user_id").references(() => usersTable.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
);

export const donationsTable = pgTable(
  "donations",
  {
    id: serial("id").primaryKey(),
    churchId: integer("church_id").notNull().references(() => churchesTable.id),
    memberId: integer("member_id").references(() => usersTable.id),
    donorName: text("donor_name"),
    donorEmail: text("donor_email"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    donationDate: timestamp("donation_date", { withTimezone: true }).notNull().defaultNow(),
    donationType: text("donation_type", { enum: ["one_time", "recurring"] }).notNull().default("one_time"),
    givingCategory: text("giving_category", { enum: GIVING_CATEGORIES }).notNull().default("tithe"),
    serviceSessionId: integer("service_session_id").references(() => attendanceSessionsTable.id),
    campaignId: integer("campaign_id").references(() => givingCampaignsTable.id),
    givingIntentId: integer("giving_intent_id").references(() => givingIntentsTable.id),
    paymentMethod: text("payment_method", { enum: PAYMENT_METHODS }).notNull().default("stripe"),
    providerTransactionId: text("provider_transaction_id"),
    providerCustomerId: text("provider_customer_id"),
    providerReceiptUrl: text("provider_receipt_url"),
    rawProviderPayload: jsonb("raw_provider_payload"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripeReceiptUrl: text("stripe_receipt_url"),
    paymentStatus: text("payment_status", { enum: PAYMENT_STATUSES }).notNull().default("pending"),
    isAnonymous: boolean("is_anonymous").notNull().default(false),
    matchConfidence: integer("match_confidence"),
    matchedByUserId: integer("matched_by_user_id").references(() => usersTable.id),
    taxDeductible: boolean("tax_deductible").notNull().default(true),
    receiptIssued: boolean("receipt_issued").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("donations_provider_txn_uq")
      .on(t.paymentMethod, t.providerTransactionId)
      .where(sql`${t.providerTransactionId} IS NOT NULL`),
  ],
);

export const recurringDonationsTable = pgTable("recurring_donations", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  memberId: integer("member_id").notNull().references(() => usersTable.id),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  amountCents: integer("amount_cents").notNull(),
  givingCategory: text("giving_category", { enum: GIVING_CATEGORIES }).notNull().default("tithe"),
  campaignId: integer("campaign_id").references(() => givingCampaignsTable.id),
  frequency: text("frequency", { enum: GIVING_FREQUENCIES }).notNull().default("monthly"),
  status: text("status", { enum: ["active", "past_due", "cancelled", "incomplete"] }).notNull().default("incomplete"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
  nextPaymentDate: timestamp("next_payment_date", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const taxReceiptsTable = pgTable("tax_receipts", {
  id: serial("id").primaryKey(),
  churchId: integer("church_id").notNull().references(() => churchesTable.id),
  memberId: integer("member_id").notNull().references(() => usersTable.id),
  year: integer("year").notNull(),
  totalAmountCents: integer("total_amount_cents").notNull().default(0),
  taxDeductibleTotalCents: integer("tax_deductible_total_cents").notNull().default(0),
  pdfUrl: text("pdf_url"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  generatedByUserId: integer("generated_by_user_id").references(() => usersTable.id),
});

export const insertDonationSchema = createInsertSchema(donationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRecurringDonationSchema = createInsertSchema(recurringDonationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertGivingCampaignSchema = createInsertSchema(givingCampaignsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaxReceiptSchema = createInsertSchema(taxReceiptsTable).omit({ id: true });
export const insertGivingIntentSchema = createInsertSchema(givingIntentsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Donation = typeof donationsTable.$inferSelect;
export type RecurringDonation = typeof recurringDonationsTable.$inferSelect;
export type GivingCampaign = typeof givingCampaignsTable.$inferSelect;
export type TaxReceipt = typeof taxReceiptsTable.$inferSelect;
export type GivingIntent = typeof givingIntentsTable.$inferSelect;
export type InsertDonation = z.infer<typeof insertDonationSchema>;
export type InsertGivingIntent = z.infer<typeof insertGivingIntentSchema>;
