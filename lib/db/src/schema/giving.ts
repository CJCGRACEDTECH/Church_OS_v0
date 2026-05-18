import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const givingCampaignsTable = pgTable("giving_campaigns", {
  id: serial("id").primaryKey(),
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

export const donationsTable = pgTable("donations", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull().references(() => usersTable.id),
  donorName: text("donor_name").notNull(),
  donorEmail: text("donor_email").notNull(),
  amountCents: integer("amount_cents").notNull(),
  donationDate: timestamp("donation_date", { withTimezone: true }).notNull().defaultNow(),
  donationType: text("donation_type", { enum: ["one_time", "recurring"] }).notNull().default("one_time"),
  givingCategory: text("giving_category", { enum: ["tithe", "offering", "building_fund", "missions", "special_campaign", "other"] }).notNull().default("tithe"),
  campaignId: integer("campaign_id").references(() => givingCampaignsTable.id),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeReceiptUrl: text("stripe_receipt_url"),
  paymentStatus: text("payment_status", { enum: ["pending", "succeeded", "failed", "refunded"] }).notNull().default("pending"),
  taxDeductible: boolean("tax_deductible").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const recurringDonationsTable = pgTable("recurring_donations", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull().references(() => usersTable.id),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  amountCents: integer("amount_cents").notNull(),
  givingCategory: text("giving_category", { enum: ["tithe", "offering", "building_fund", "missions", "special_campaign", "other"] }).notNull().default("tithe"),
  campaignId: integer("campaign_id").references(() => givingCampaignsTable.id),
  frequency: text("frequency", { enum: ["weekly", "biweekly", "monthly", "yearly"] }).notNull().default("monthly"),
  status: text("status", { enum: ["active", "past_due", "cancelled", "incomplete"] }).notNull().default("incomplete"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
  nextPaymentDate: timestamp("next_payment_date", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const taxReceiptsTable = pgTable("tax_receipts", {
  id: serial("id").primaryKey(),
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

export type Donation = typeof donationsTable.$inferSelect;
export type RecurringDonation = typeof recurringDonationsTable.$inferSelect;
export type GivingCampaign = typeof givingCampaignsTable.$inferSelect;
export type TaxReceipt = typeof taxReceiptsTable.$inferSelect;
export type InsertDonation = z.infer<typeof insertDonationSchema>;
