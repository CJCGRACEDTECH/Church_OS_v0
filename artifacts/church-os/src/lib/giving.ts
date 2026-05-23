export type GivingCategory = "tithe" | "offering" | "building_fund" | "missions" | "special_campaign" | "other";
export type DonationType = "one_time" | "recurring";
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";
export type CampaignStatus = "draft" | "active" | "completed" | "cancelled";
export type GivingFrequency = "weekly" | "biweekly" | "monthly" | "yearly";

export type Donation = {
  id: number;
  memberId: number;
  donorName: string;
  donorEmail: string;
  amountCents: number;
  donationDate: string;
  donationType: DonationType;
  givingCategory: GivingCategory;
  campaignId: number | null;
  campaignName?: string | null;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripeReceiptUrl: string | null;
  paymentStatus: PaymentStatus;
  taxDeductible: boolean;
  receiptIssued: boolean;
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

