import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  donationsTable,
  givingCampaignsTable,
  recurringDonationsTable,
  usersTable,
  type Donation,
  type GivingCampaign,
  type RecurringDonation,
} from "@workspace/db";
import { ADMIN_PERMISSIONS } from "../lib/admin-permissions";
import { requireAdminPermission, requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
const requireGivingManagement = requireAdminPermission(ADMIN_PERMISSIONS.GIVING_MANAGEMENT);
const requireGivingReports = requireAdminPermission(ADMIN_PERMISSIONS.GIVING_REPORTS);
const requireCampaignManagement = requireAdminPermission(ADMIN_PERMISSIONS.CAMPAIGN_MANAGEMENT);

const CATEGORIES = new Set(["tithe", "offering", "building_fund", "missions", "special_campaign", "other"]);
const FREQUENCIES = new Set(["weekly", "biweekly", "monthly", "yearly"]);
const CAMPAIGN_STATUSES = new Set(["draft", "active", "completed", "cancelled"]);
const PAYMENT_STATUSES = new Set(["pending", "succeeded", "failed", "refunded"]);

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function enumValue<T extends string>(value: unknown, allowed: Set<string>, fallback: T): T {
  return typeof value === "string" && allowed.has(value) ? (value as T) : fallback;
}

function cents(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount * 100)) : 0;
}

function dollars(value: number) {
  return `$${(value / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function getUser(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return user ?? null;
}

function serializeDonation(donation: Donation) {
  return {
    id: donation.id,
    memberId: donation.memberId,
    donorName: donation.donorName,
    donorEmail: donation.donorEmail,
    amountCents: donation.amountCents,
    donationDate: donation.donationDate.toISOString(),
    donationType: donation.donationType,
    givingCategory: donation.givingCategory,
    campaignId: donation.campaignId,
    stripePaymentIntentId: donation.stripePaymentIntentId,
    stripeCheckoutSessionId: donation.stripeCheckoutSessionId,
    stripeCustomerId: donation.stripeCustomerId,
    stripeSubscriptionId: donation.stripeSubscriptionId,
    stripeReceiptUrl: donation.stripeReceiptUrl,
    paymentStatus: donation.paymentStatus,
    taxDeductible: donation.taxDeductible,
    receiptIssued: donation.receiptIssued,
    createdAt: donation.createdAt.toISOString(),
    updatedAt: donation.updatedAt.toISOString(),
  };
}

function serializeCampaign(campaign: GivingCampaign, amountRaisedCents = 0) {
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

function serializeRecurring(recurring: RecurringDonation) {
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

async function campaignRaised(campaignId: number, churchId: number) {
  const rows = await db.select().from(donationsTable).where(and(eq(donationsTable.campaignId, campaignId), eq(donationsTable.churchId, churchId), eq(donationsTable.paymentStatus, "succeeded")));
  return rows.reduce((sum, donation) => sum + donation.amountCents, 0);
}

async function createStripeCheckout(params: {
  mode: "payment" | "subscription";
  amountCents: number;
  category: string;
  campaignId: number | null;
  memberId: number;
  donorEmail: string;
  frequency?: string;
}) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      setupRequired: true,
      checkoutUrl: null,
      message: "Stripe is not configured. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Replit Secrets.",
    };
  }

  const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:5173";
  const body = new URLSearchParams({
    mode: params.mode,
    success_url: `${appBaseUrl}/member/give?checkout=success`,
    cancel_url: `${appBaseUrl}/member/give?checkout=cancelled`,
    customer_email: params.donorEmail,
    "metadata[member_id]": String(params.memberId),
    "metadata[giving_category]": params.category,
    "metadata[campaign_id]": params.campaignId ? String(params.campaignId) : "",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(params.amountCents),
    "line_items[0][price_data][product_data][name]": `Church OS Giving - ${params.category.replace(/_/g, " ")}`,
  });

  if (params.mode === "subscription") {
    const interval = params.frequency === "yearly" ? "year" : params.frequency === "weekly" || params.frequency === "biweekly" ? "week" : "month";
    body.set("line_items[0][price_data][recurring][interval]", interval);
    if (params.frequency === "biweekly") body.set("line_items[0][price_data][recurring][interval_count]", "2");
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const data = await response.json() as { id?: string; url?: string; customer?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? "Stripe Checkout failed.");
  return { setupRequired: false, checkoutUrl: data.url ?? null, checkoutSessionId: data.id ?? null };
}

router.get("/giving/campaigns", requireAuth, async (req, res) => {
  const campaigns = await db.select().from(givingCampaignsTable).where(and(eq(givingCampaignsTable.churchId, req.localChurchId), eq(givingCampaignsTable.status, "active"))).orderBy(desc(givingCampaignsTable.createdAt));
  res.json({ campaigns: await Promise.all(campaigns.map(async (campaign) => serializeCampaign(campaign, await campaignRaised(campaign.id, req.localChurchId)))) });
});

router.get("/giving/history", requireAuth, async (req, res): Promise<void> => {
  const year = typeof req.query.year === "string" ? Number(req.query.year) : null;
  const filters = [eq(donationsTable.memberId, req.localUserId)];
  if (year) {
    filters.push(gte(donationsTable.donationDate, new Date(`${year}-01-01T00:00:00Z`)));
    filters.push(lte(donationsTable.donationDate, new Date(`${year}-12-31T23:59:59Z`)));
  }
  const donations = await db.select().from(donationsTable).where(and(...filters)).orderBy(desc(donationsTable.donationDate));
  const recurring = await db.select().from(recurringDonationsTable).where(eq(recurringDonationsTable.memberId, req.localUserId)).orderBy(desc(recurringDonationsTable.createdAt));
  res.json({ donations: donations.map(serializeDonation), recurring: recurring.map(serializeRecurring) });
});

router.post("/giving/checkout", requireAuth, async (req, res): Promise<void> => {
  const user = await getUser(req.localUserId);
  if (!user || user.role !== "member") { res.status(403).json({ error: "Member giving requires a member account." }); return; }
  const amountCents = cents(req.body?.amount);
  const category = enumValue(req.body?.givingCategory, CATEGORIES, "tithe");
  const donationType = req.body?.donationType === "recurring" ? "recurring" : "one_time";
  const campaignId = req.body?.campaignId ? Number(req.body.campaignId) : null;
  const frequency = enumValue(req.body?.frequency, FREQUENCIES, "monthly");
  if (amountCents < 100) { res.status(400).json({ error: "Minimum giving amount is $1.00." }); return; }

  if (campaignId) {
    const [campaign] = await db.select({ id: givingCampaignsTable.id }).from(givingCampaignsTable).where(and(eq(givingCampaignsTable.id, campaignId), eq(givingCampaignsTable.churchId, req.localChurchId), eq(givingCampaignsTable.status, "active")));
    if (!campaign) { res.status(400).json({ error: "Campaign not found or not available." }); return; }
  }

  const checkout = await createStripeCheckout({
    mode: donationType === "recurring" ? "subscription" : "payment",
    amountCents,
    category,
    campaignId,
    memberId: user.id,
    donorEmail: user.email,
    frequency,
  });

  if (checkout.setupRequired) {
    res.json(checkout);
    return;
  }

  const donorName = `${user.firstName} ${user.lastName}`;
  const [donation] = await db.insert(donationsTable).values({
    churchId: req.localChurchId,
    memberId: user.id,
    donorName,
    donorEmail: user.email,
    amountCents,
    donationType,
    givingCategory: category,
    campaignId,
    stripeCheckoutSessionId: checkout.checkoutSessionId,
    paymentStatus: "pending",
  }).returning();

  if (donationType === "recurring") {
    await db.insert(recurringDonationsTable).values({
      churchId: req.localChurchId,
      memberId: user.id,
      amountCents,
      givingCategory: category,
      campaignId,
      frequency,
      status: "incomplete",
    });
  }

  res.json({ ...checkout, donation: serializeDonation(donation) });
});

router.get("/giving/receipts/:year", requireAuth, async (req, res): Promise<void> => {
  const year = Number(req.params.year);
  if (!Number.isInteger(year)) { res.status(400).send("Invalid year"); return; }
  const user = await getUser(req.localUserId);
  if (!user) { res.status(401).send("Not authenticated"); return; }
  const donations = await db.select().from(donationsTable).where(and(
    eq(donationsTable.memberId, user.id),
    eq(donationsTable.paymentStatus, "succeeded"),
    gte(donationsTable.donationDate, new Date(`${year}-01-01T00:00:00Z`)),
    lte(donationsTable.donationDate, new Date(`${year}-12-31T23:59:59Z`)),
  )).orderBy(donationsTable.donationDate);
  res.setHeader("content-type", "text/html; charset=utf-8");
  res.setHeader("content-disposition", `inline; filename="church-os-giving-receipt-${year}.html"`);
  res.send(receiptHtml({ user, donations, year }));
});

router.get("/admin/giving/summary", requireGivingManagement, async (req, res) => {
  const now = new Date();
  const yearStart = new Date(`${now.getFullYear()}-01-01T00:00:00Z`);
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const donations = await db.select().from(donationsTable).where(eq(donationsTable.churchId, req.localChurchId));
  const succeeded = donations.filter((donation) => donation.paymentStatus === "succeeded");
  const succeededYear = succeeded.filter((donation) => donation.donationDate >= yearStart);
  const campaigns = await db.select().from(givingCampaignsTable).where(eq(givingCampaignsTable.churchId, req.localChurchId));
  const totalYearCents = succeededYear.reduce((sum, donation) => sum + donation.amountCents, 0);
  res.json({
    totalYearCents,
    totalMonthCents: succeeded.filter((donation) => donation.donationDate >= monthStart).reduce((sum, donation) => sum + donation.amountCents, 0),
    recurringCents: succeeded.filter((donation) => donation.donationType === "recurring").reduce((sum, donation) => sum + donation.amountCents, 0),
    campaignRaisedCents: succeeded.filter((donation) => donation.campaignId).reduce((sum, donation) => sum + donation.amountCents, 0),
    donorsCount: new Set(succeeded.map((donation) => donation.memberId)).size,
    avgGiftCents: succeededYear.length > 0 ? Math.round(totalYearCents / succeededYear.length) : 0,
    failedPayments: donations.filter((donation) => donation.paymentStatus === "failed").length,
    activeCampaigns: campaigns.filter((campaign) => campaign.status === "active").length,
  });
});

router.get("/admin/giving/donations", requireGivingManagement, async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const year = typeof req.query.year === "string" ? Number(req.query.year) : null;
  const fromDate = typeof req.query.fromDate === "string" ? req.query.fromDate : null;
  const toDate = typeof req.query.toDate === "string" ? req.query.toDate : null;
  const category = typeof req.query.category === "string" ? req.query.category : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const filters = [
    eq(donationsTable.churchId, req.localChurchId),
    ...(search ? [or(ilike(donationsTable.donorName, `%${search}%`), ilike(donationsTable.donorEmail, `%${search}%`))] : []),
    ...(fromDate ? [gte(donationsTable.donationDate, new Date(fromDate))] : year ? [gte(donationsTable.donationDate, new Date(`${year}-01-01T00:00:00Z`))] : []),
    ...(toDate ? [lte(donationsTable.donationDate, new Date(`${toDate}T23:59:59Z`))] : year ? [lte(donationsTable.donationDate, new Date(`${year}-12-31T23:59:59Z`))] : []),
    ...(CATEGORIES.has(category) ? [eq(donationsTable.givingCategory, category as typeof donationsTable.$inferSelect.givingCategory)] : []),
    ...(PAYMENT_STATUSES.has(status) ? [eq(donationsTable.paymentStatus, status as typeof donationsTable.$inferSelect.paymentStatus)] : []),
  ];
  const donations = await db.select().from(donationsTable).where(and(...filters)).orderBy(desc(donationsTable.donationDate));
  res.json({ donations: donations.map(serializeDonation) });
});

router.patch("/admin/giving/donations/:id", requireGivingManagement, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid donation." }); return; }
  const updates: Partial<{ taxDeductible: boolean; receiptIssued: boolean }> = {};
  if (typeof req.body?.taxDeductible === "boolean") updates.taxDeductible = req.body.taxDeductible;
  if (typeof req.body?.receiptIssued === "boolean") updates.receiptIssued = req.body.receiptIssued;
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "No valid fields to update." }); return; }
  const [donation] = await db.update(donationsTable).set(updates).where(and(eq(donationsTable.id, id), eq(donationsTable.churchId, req.localChurchId))).returning();
  if (!donation) { res.status(404).json({ error: "Donation not found." }); return; }
  res.json({ donation: serializeDonation(donation) });
});

router.get("/admin/giving/export.csv", requireGivingReports, async (req, res) => {
  const rows = await db
    .select({
      id: donationsTable.id,
      donorName: donationsTable.donorName,
      donorEmail: donationsTable.donorEmail,
      amountCents: donationsTable.amountCents,
      donationDate: donationsTable.donationDate,
      donationType: donationsTable.donationType,
      givingCategory: donationsTable.givingCategory,
      paymentStatus: donationsTable.paymentStatus,
      taxDeductible: donationsTable.taxDeductible,
      receiptIssued: donationsTable.receiptIssued,
      campaignName: givingCampaignsTable.campaignName,
    })
    .from(donationsTable)
    .leftJoin(givingCampaignsTable, eq(donationsTable.campaignId, givingCampaignsTable.id))
    .where(eq(donationsTable.churchId, req.localChurchId))
    .orderBy(desc(donationsTable.donationDate));
  const csvRows = ["Donation ID,Donor Name,Donor Email,Amount,Date,Type,Category,Campaign,Status,Tax Deductible,Receipt Issued"];
  rows.forEach((row) => csvRows.push([
    row.id,
    JSON.stringify(row.donorName),
    row.donorEmail,
    (row.amountCents / 100).toFixed(2),
    row.donationDate.toISOString(),
    row.donationType,
    row.givingCategory,
    JSON.stringify(row.campaignName ?? ""),
    row.paymentStatus,
    row.taxDeductible ? "yes" : "no",
    row.receiptIssued ? "yes" : "no",
  ].join(",")));
  res.setHeader("content-type", "text/csv");
  res.setHeader("content-disposition", "attachment; filename=giving-records.csv");
  res.send(csvRows.join("\n"));
});

router.get("/admin/giving/campaigns", requireGivingManagement, async (req, res) => {
  const campaigns = await db.select().from(givingCampaignsTable).where(eq(givingCampaignsTable.churchId, req.localChurchId)).orderBy(desc(givingCampaignsTable.createdAt));
  res.json({ campaigns: await Promise.all(campaigns.map(async (campaign) => serializeCampaign(campaign, await campaignRaised(campaign.id, req.localChurchId)))) });
});

router.post("/admin/giving/campaigns", requireCampaignManagement, async (req, res): Promise<void> => {
  const name = typeof req.body?.campaignName === "string" ? req.body.campaignName.trim() : "";
  if (!name) { res.status(400).json({ error: "Campaign name is required." }); return; }
  const [campaign] = await db.insert(givingCampaignsTable).values({
    churchId: req.localChurchId,
    campaignName: name,
    description: textOrNull(req.body?.description),
    goalAmountCents: cents(req.body?.goalAmount),
    startDate: req.body?.startDate ? new Date(req.body.startDate) : null,
    endDate: req.body?.endDate ? new Date(req.body.endDate) : null,
    status: enumValue(req.body?.status, CAMPAIGN_STATUSES, "draft"),
    campaignImageUrl: textOrNull(req.body?.campaignImageUrl),
    campaignCategory: textOrNull(req.body?.campaignCategory),
    createdByUserId: req.localUserId,
  }).returning();
  res.status(201).json({ campaign: serializeCampaign(campaign, 0) });
});

router.patch("/admin/giving/campaigns/:id", requireCampaignManagement, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid campaign." }); return; }
  const [campaign] = await db.update(givingCampaignsTable).set({
    campaignName: typeof req.body?.campaignName === "string" ? req.body.campaignName.trim() : undefined,
    description: textOrNull(req.body?.description),
    goalAmountCents: req.body?.goalAmount ? cents(req.body.goalAmount) : undefined,
    startDate: "startDate" in req.body ? (req.body.startDate ? new Date(req.body.startDate) : null) : undefined,
    endDate: "endDate" in req.body ? (req.body.endDate ? new Date(req.body.endDate) : null) : undefined,
    status: enumValue(req.body?.status, CAMPAIGN_STATUSES, "draft"),
    campaignImageUrl: textOrNull(req.body?.campaignImageUrl),
    campaignCategory: textOrNull(req.body?.campaignCategory),
  }).where(and(eq(givingCampaignsTable.id, id), eq(givingCampaignsTable.churchId, req.localChurchId))).returning();
  if (!campaign) { res.status(404).json({ error: "Campaign not found." }); return; }
  res.json({ campaign: serializeCampaign(campaign, await campaignRaised(campaign.id, req.localChurchId)) });
});

router.post("/giving/stripe/webhook", async (req, res): Promise<void> => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
  const signature = req.headers["stripe-signature"];
  if (process.env.STRIPE_WEBHOOK_SECRET && !validStripeSignature(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET)) {
    res.status(400).json({ error: "Invalid Stripe signature." });
    return;
  }
  const event = JSON.parse(rawBody.toString()) as { type?: string; data?: { object?: Record<string, unknown> } };
  await syncStripeEvent(event.type ?? "", event.data?.object ?? {});
  res.json({ received: true });
});

async function syncStripeEvent(type: string, object: Record<string, unknown>) {
  if (type === "checkout.session.completed") {
    const sessionId = String(object.id ?? "");
    const paymentIntent = object.payment_intent ? String(object.payment_intent) : null;
    const customer = object.customer ? String(object.customer) : null;
    const subscription = object.subscription ? String(object.subscription) : null;
    const metadata = typeof object.metadata === "object" && object.metadata ? object.metadata as Record<string, string> : {};
    await db.update(donationsTable).set({
      paymentStatus: "succeeded",
      stripePaymentIntentId: paymentIntent,
      stripeCustomerId: customer,
      stripeSubscriptionId: subscription,
    }).where(eq(donationsTable.stripeCheckoutSessionId, sessionId));
    if (subscription && metadata.member_id) {
      await db.update(recurringDonationsTable).set({
        stripeSubscriptionId: subscription,
        stripeCustomerId: customer,
        status: "active",
      }).where(and(eq(recurringDonationsTable.memberId, Number(metadata.member_id)), eq(recurringDonationsTable.status, "incomplete")));
    }
  }
  if (type === "payment_intent.payment_failed") {
    await db.update(donationsTable).set({ paymentStatus: "failed" }).where(eq(donationsTable.stripePaymentIntentId, String(object.id ?? "")));
  }
  if (type === "charge.refunded") {
    await db.update(donationsTable).set({ paymentStatus: "refunded" }).where(eq(donationsTable.stripePaymentIntentId, String(object.payment_intent ?? "")));
  }
  if (type === "customer.subscription.deleted") {
    await db.update(recurringDonationsTable).set({
      status: "cancelled",
      cancelledAt: new Date(),
    }).where(eq(recurringDonationsTable.stripeSubscriptionId, String(object.id ?? "")));
  }
}

function validStripeSignature(rawBody: Buffer, signatureHeader: unknown, secret: string) {
  if (typeof signatureHeader !== "string") return false;
  const parts = Object.fromEntries(signatureHeader.split(",").map((item) => item.split("=")));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const payload = `${timestamp}.${rawBody.toString()}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function receiptHtml({ user, donations, year }: { user: NonNullable<Awaited<ReturnType<typeof getUser>>>; donations: Donation[]; year: number }) {
  const total = donations.reduce((sum, donation) => sum + donation.amountCents, 0);
  const deductible = donations.filter((donation) => donation.taxDeductible).reduce((sum, donation) => sum + donation.amountCents, 0);
  const rows = donations.map((donation) => `<tr><td>${donation.donationDate.toLocaleDateString()}</td><td>${dollars(donation.amountCents)}</td><td>${donation.givingCategory}</td><td>${donation.campaignId ?? ""}</td></tr>`).join("");
  return `<!doctype html><html><head><title>${year} Giving Receipt</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#111}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}.total{font-weight:700}</style></head><body><h1>Church OS Giving Receipt</h1><p>Church address: TODO in Replit settings<br/>Church EIN/Tax ID: TODO</p><h2>${user.firstName} ${user.lastName}</h2><p>${user.email}</p><p>Donation year: ${year}</p><table><thead><tr><th>Date</th><th>Amount</th><th>Category</th><th>Campaign</th></tr></thead><tbody>${rows}</tbody></table><p class="total">Total giving: ${dollars(total)}</p><p class="total">Tax-deductible total: ${dollars(deductible)}</p><p>Generated: ${new Date().toLocaleDateString()}</p><p>No goods or services were provided in exchange for these contributions, other than intangible religious benefits.</p></body></html>`;
}

export default router;
