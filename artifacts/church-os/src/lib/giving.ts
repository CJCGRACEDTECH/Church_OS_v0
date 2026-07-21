export type GivingCategory = "love_offering" | "tithe" | "kingdom_commitment" | "giftings";
export type DonationType = "one_time" | "recurring";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded" | "disputed";
export type CampaignStatus = "draft" | "active" | "completed" | "cancelled";
export type GivingFrequency = "weekly" | "biweekly" | "monthly" | "yearly";
export type PaymentMethod = "stripe" | "paypal" | "square" | "cash_app" | "venmo" | "zelle" | "manual";
export type IntentStatus = "pending" | "completed" | "failed" | "cancelled" | "refunded" | "expired";

export const GIVING_CATEGORIES: { value: GivingCategory; label: string }[] = [
  { value: "love_offering", label: "Love Offering" },
  { value: "tithe", label: "Tithe" },
  { value: "kingdom_commitment", label: "Kingdom Commitment" },
  { value: "giftings", label: "Giftings" },
];

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "stripe", label: "Card (Stripe)" },
  { value: "cash_app", label: "Cash App" },
  { value: "paypal", label: "PayPal" },
  { value: "square", label: "Square" },
  { value: "venmo", label: "Venmo" },
  { value: "zelle", label: "Zelle" },
  { value: "manual", label: "Manual" },
];

export type Donation = {
  id: number;
  memberId: number | null;
  donorName: string | null;
  donorEmail: string | null;
  amountCents: number;
  currency?: string;
  donationDate: string;
  donationType: DonationType;
  givingCategory: GivingCategory;
  serviceSessionId: number | null;
  campaignId: number | null;
  campaignName?: string | null;
  givingIntentId?: number | null;
  paymentMethod?: PaymentMethod;
  providerTransactionId?: string | null;
  providerReceiptUrl?: string | null;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeReceiptUrl: string | null;
  paymentStatus: PaymentStatus;
  isAnonymous?: boolean;
  matchConfidence?: number | null;
  taxDeductible: boolean;
  receiptIssued: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GivingIntent = {
  id: number;
  memberId: number | null;
  donorName: string | null;
  donorEmail: string | null;
  amountCents: number;
  currency: string;
  givingCategory: GivingCategory;
  campaignId: number | null;
  paymentMethod: PaymentMethod;
  donationType: DonationType;
  frequency: GivingFrequency | null;
  status: IntentStatus;
  providerRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecurringDonation = {
  id: number;
  memberId: number;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  amountCents: number;
  givingCategory: GivingCategory;
  campaignId: number | null;
  frequency: GivingFrequency;
  status: string;
  startDate: string;
  nextPaymentDate: string | null;
  cancelledAt: string | null;
};

export type GivingCampaign = {
  id: number;
  campaignName: string;
  description: string | null;
  goalAmountCents: number;
  amountRaisedCents: number;
  progressPercent: number;
  startDate: string | null;
  endDate: string | null;
  status: CampaignStatus;
  campaignImageUrl: string | null;
  campaignCategory: string | null;
  createdByUserId: number | null;
  createdAt: string;
  updatedAt: string;
};

export type GivingSummary = {
  totalYearCents: number;
  totalMonthCents: number;
  recurringCents: number;
  campaignRaisedCents: number;
  donorsCount: number;
  avgGiftCents: number;
  failedPayments: number;
  activeCampaigns: number;
};

export async function apiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const demoToken = sessionStorage.getItem("demo_token");
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(demoToken ? { authorization: `Bearer ${demoToken}` } : {}),
      ...(options?.headers ?? {}),
    },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

export function dollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function labelize(value: string | null | undefined) {
  if (!value) return "Not set";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export type AliasType = "cashapp_handle" | "venmo_username" | "paypal_email" | "zelle_name" | "zelle_phone" | "zelle_email" | "other";

export const ALIAS_TYPES: { value: AliasType; label: string }[] = [
  { value: "cashapp_handle", label: "Cash App handle" },
  { value: "venmo_username", label: "Venmo username" },
  { value: "paypal_email", label: "PayPal email" },
  { value: "zelle_name", label: "Zelle sender name" },
  { value: "zelle_phone", label: "Zelle phone" },
  { value: "zelle_email", label: "Zelle email" },
  { value: "other", label: "Other" },
];

export type MemberPaymentAlias = {
  id: number;
  memberId: number;
  aliasType: AliasType;
  aliasValue: string;
  verified: boolean;
  createdAt: string;
};

export type UnmatchedDonation = {
  id: number;
  paymentMethod: PaymentMethod;
  amountCents: number;
  currency: string;
  transactionDate: string;
  senderName: string | null;
  senderEmail: string | null;
  senderPhone: string | null;
  senderHandle: string | null;
  memo: string | null;
  givingCategory: GivingCategory | null;
  status: "pending" | "matched" | "visitor" | "anonymous" | "ignored" | "duplicate";
  suggestedMatches: { memberId: number; confidence: number; reasons: string[] }[] | null;
  resolvedDonationId: number | null;
  createdAt: string;
};
