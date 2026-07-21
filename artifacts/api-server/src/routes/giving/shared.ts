import { and, eq } from "drizzle-orm";
import {
  db,
  donationsTable,
  usersTable,
  type Donation,
  type GivingCampaign,
  type RecurringDonation,
} from "@workspace/db";
import { ADMIN_PERMISSIONS } from "../../lib/admin-permissions";
import { requireAdminPermission } from "../../middlewares/auth";

export const requireGivingManagement = requireAdminPermission(ADMIN_PERMISSIONS.GIVING_MANAGEMENT);
export const requireCampaignManagement = requireAdminPermission(ADMIN_PERMISSIONS.CAMPAIGN_MANAGEMENT);

export const CATEGORIES = new Set(["love_offering", "tithe", "kingdom_commitment", "giftings"]);
export const FREQUENCIES = new Set(["weekly", "biweekly", "monthly", "yearly"]);
export const CAMPAIGN_STATUSES = new Set(["draft", "active", "completed", "cancelled"]);
export const PAYMENT_STATUSES = new Set(["pending", "succeeded", "failed", "refunded", "disputed"]);
export const PAYMENT_METHOD_VALUES = new Set(["stripe", "paypal", "square", "cash_app", "venmo", "zelle", "manual"]);
export const ONLINE_PAYMENT_METHODS = new Set(["stripe", "cash_app", "paypal", "venmo"]);

export function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function enumValue<T extends string>(value: unknown, allowed: Set<string>, fallback: T): T {
  return typeof value === "string" && allowed.has(value) ? (value as T) : fallback;
}

export function cents(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

export function positiveIntegerOrNull(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function dollars(value: number) {
  return `$${(value / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function getUser(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return user ?? null;
}

export function serializeDonation(donation: Donation) {
  return {
    id: donation.id,
    memberId: donation.memberId,
    donorName: donation.donorName,
    donorEmail: donation.donorEmail,
    amountCents: donation.amountCents,
    currency: donation.currency,
    donationDate: donation.donationDate.toISOString(),
    donationType: donation.donationType,
    givingCategory: donation.givingCategory,
    serviceSessionId: donation.serviceSessionId,
    campaignId: donation.campaignId,
    givingIntentId: donation.givingIntentId,
    paymentMethod: donation.paymentMethod,
    providerTransactionId: donation.providerTransactionId,
    providerReceiptUrl: donation.providerReceiptUrl,
    stripePaymentIntentId: donation.stripePaymentIntentId,
    stripeCheckoutSessionId: donation.stripeCheckoutSessionId,
    stripeCustomerId: donation.stripeCustomerId,
    stripeSubscriptionId: donation.stripeSubscriptionId,
    stripeReceiptUrl: donation.stripeReceiptUrl,
    paymentStatus: donation.paymentStatus,
    isAnonymous: donation.isAnonymous,
    matchConfidence: donation.matchConfidence,
    taxDeductible: donation.taxDeductible,
    receiptIssued: donation.receiptIssued,
    createdAt: donation.createdAt.toISOString(),
    updatedAt: donation.updatedAt.toISOString(),
  };
}

export function serializeCampaign(campaign: GivingCampaign, amountRaisedCents = 0) {
  return {
    id: campaign.id,
    campaignName: campaign.campaignName,
    description: campaign.description,
    goalAmountCents: campaign.goalAmountCents,
    amountRaisedCents,
    progressPercent: campaign.goalAmountCents > 0 ? Math.min(100, Math.round((amountRaisedCents / campaign.goalAmountCents) * 100)) : 0,
    startDate: campaign.startDate?.toISOString() ?? null,
    endDate: campaign.endDate?.toISOString() ?? null,
    status: campaign.status,
    campaignImageUrl: campaign.campaignImageUrl,
    campaignCategory: campaign.campaignCategory,
    createdByUserId: campaign.createdByUserId,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

export function serializeRecurring(recurring: RecurringDonation) {
  return {
    id: recurring.id,
    memberId: recurring.memberId,
    stripeSubscriptionId: recurring.stripeSubscriptionId,
    stripeCustomerId: recurring.stripeCustomerId,
    amountCents: recurring.amountCents,
    givingCategory: recurring.givingCategory,
    campaignId: recurring.campaignId,
    frequency: recurring.frequency,
    status: recurring.status,
    startDate: recurring.startDate.toISOString(),
    nextPaymentDate: recurring.nextPaymentDate?.toISOString() ?? null,
    cancelledAt: recurring.cancelledAt?.toISOString() ?? null,
  };
}

export async function campaignRaised(campaignId: number, churchId: number) {
  const rows = await db.select().from(donationsTable).where(and(eq(donationsTable.campaignId, campaignId), eq(donationsTable.churchId, churchId), eq(donationsTable.paymentStatus, "succeeded")));
  return rows.reduce((sum, donation) => sum + donation.amountCents, 0);
}
