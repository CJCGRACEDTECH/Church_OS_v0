import { and, desc, eq, gte, lte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  donationsTable,
  givingCampaignsTable,
  recurringDonationsTable,
  type Donation,
  type PaymentMethod,
} from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";
import { createStripeCheckout } from "../../lib/payments/providers/stripe";
import { capturePaypalOrder, createPaypalOrder } from "../../lib/payments/providers/paypal";
import { createIntent, setIntentProviderRef, setIntentStatus } from "../../lib/payments/intent";
import {
  CATEGORIES,
  FREQUENCIES,
  ONLINE_PAYMENT_METHODS,
  campaignRaised,
  cents,
  dollars,
  enumValue,
  getUser,
  positiveIntegerOrNull,
  serializeCampaign,
  serializeDonation,
  serializeRecurring,
} from "./shared";

const router: IRouter = Router();

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
  const donationRows = await db
    .select({ donation: donationsTable, campaignName: givingCampaignsTable.campaignName })
    .from(donationsTable)
    .leftJoin(givingCampaignsTable, eq(donationsTable.campaignId, givingCampaignsTable.id))
    .where(and(...filters))
    .orderBy(desc(donationsTable.donationDate));
  const recurring = await db.select().from(recurringDonationsTable).where(eq(recurringDonationsTable.memberId, req.localUserId)).orderBy(desc(recurringDonationsTable.createdAt));
  res.json({
    donations: donationRows.map((row) => ({ ...serializeDonation(row.donation), campaignName: row.campaignName ?? null })),
    recurring: recurring.map(serializeRecurring),
  });
});

router.post("/giving/checkout", requireAuth, async (req, res): Promise<void> => {
  const user = await getUser(req.localUserId);
  if (!user || user.role !== "member") { res.status(403).json({ error: "Member giving requires a member account." }); return; }
  const amountCents = cents(req.body?.amount);
  const category = enumValue(req.body?.givingCategory, CATEGORIES, "tithe");
  const donationType = req.body?.donationType === "recurring" ? "recurring" : "one_time";
  const campaignId = req.body?.campaignId ? Number(req.body.campaignId) : null;
  const serviceSessionId = positiveIntegerOrNull(req.body?.serviceSessionId);
  const frequency = enumValue(req.body?.frequency, FREQUENCIES, "monthly");
  const paymentMethod = enumValue<PaymentMethod>(req.body?.paymentMethod, ONLINE_PAYMENT_METHODS, "stripe");
  if (amountCents < 100) { res.status(400).json({ error: "Minimum giving amount is $1.00." }); return; }
  if (paymentMethod !== "stripe" && donationType === "recurring") {
    res.status(400).json({ error: "Recurring gifts are only available with card giving right now." });
    return;
  }

  if (campaignId) {
    const [campaign] = await db.select({ id: givingCampaignsTable.id }).from(givingCampaignsTable).where(and(eq(givingCampaignsTable.id, campaignId), eq(givingCampaignsTable.churchId, req.localChurchId), eq(givingCampaignsTable.status, "active")));
    if (!campaign) { res.status(400).json({ error: "Campaign not found or not available." }); return; }
  }

  const donorName = `${user.firstName} ${user.lastName}`;
  const intent = await createIntent({
    churchId: req.localChurchId,
    memberId: user.id,
    donorName,
    donorEmail: user.email,
    amountCents,
    givingCategory: category,
    campaignId,
    serviceSessionId,
    paymentMethod,
    donationType,
    frequency: donationType === "recurring" ? frequency : null,
    status: "pending",
  });

  const checkout = paymentMethod === "paypal" || paymentMethod === "venmo"
    ? await createPaypalCheckout({ intent, amountCents, category, paymentMethod })
    : await createStripeCheckoutForIntent({ intent, amountCents, category, campaignId, serviceSessionId, user, donationType, frequency, paymentMethod });

  if (checkout.setupRequired) {
    await setIntentStatus(intent.id, "cancelled");
    res.json(checkout);
    return;
  }

  if (checkout.providerRef) {
    await setIntentProviderRef(intent.id, checkout.providerRef);
  }

  const [donation] = await db.insert(donationsTable).values({
    churchId: req.localChurchId,
    memberId: user.id,
    donorName,
    donorEmail: user.email,
    amountCents,
    donationType,
    givingCategory: category,
    serviceSessionId,
    campaignId,
    givingIntentId: intent.id,
    paymentMethod,
    providerTransactionId: paymentMethod === "paypal" || paymentMethod === "venmo" ? checkout.providerRef : null,
    stripeCheckoutSessionId: paymentMethod === "stripe" ? checkout.providerRef : null,
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

  res.json({ checkoutUrl: checkout.checkoutUrl, setupRequired: false, donation: serializeDonation(donation) });
});

type CheckoutOutcome =
  | { setupRequired: true; message: string }
  | { setupRequired: false; checkoutUrl: string | null; providerRef: string | null };

async function createStripeCheckoutForIntent(params: {
  intent: Awaited<ReturnType<typeof createIntent>>;
  amountCents: number;
  category: string;
  campaignId: number | null;
  serviceSessionId: number | null;
  user: NonNullable<Awaited<ReturnType<typeof getUser>>>;
  donationType: "one_time" | "recurring";
  frequency: string;
  paymentMethod: string;
}): Promise<CheckoutOutcome> {
  let checkout: Awaited<ReturnType<typeof createStripeCheckout>>;
  try {
    checkout = await createStripeCheckout({
      mode: params.donationType === "recurring" ? "subscription" : "payment",
      amountCents: params.amountCents,
      category: params.category,
      campaignId: params.campaignId,
      serviceSessionId: params.serviceSessionId,
      memberId: params.user.id,
      donorEmail: params.user.email,
      frequency: params.frequency,
      intentId: params.intent.id,
      cashApp: params.paymentMethod === "cash_app",
    });
  } catch (error) {
    await setIntentStatus(params.intent.id, "failed");
    throw error;
  }
  if (checkout.setupRequired) return { setupRequired: true, message: checkout.message ?? "Online giving is not available right now." };
  return { setupRequired: false, checkoutUrl: checkout.checkoutUrl, providerRef: checkout.checkoutSessionId ?? null };
}

async function createPaypalCheckout(params: {
  intent: Awaited<ReturnType<typeof createIntent>>;
  amountCents: number;
  category: string;
  paymentMethod: "paypal" | "venmo";
}): Promise<CheckoutOutcome> {
  const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:5173";
  let order: Awaited<ReturnType<typeof createPaypalOrder>>;
  try {
    order = await createPaypalOrder({
      intentId: params.intent.id,
      amountCents: params.amountCents,
      category: params.category,
      // PayPal appends ?token=<order_id>&PayerID=... to this URL itself.
      returnUrl: `${appBaseUrl}/member/give?checkout=success&provider=${params.paymentMethod}`,
      cancelUrl: `${appBaseUrl}/member/give?checkout=cancelled`,
      preferVenmo: params.paymentMethod === "venmo",
    });
  } catch (error) {
    await setIntentStatus(params.intent.id, "failed");
    throw error;
  }
  if (order.setupRequired) return { setupRequired: true, message: order.message };
  return { setupRequired: false, checkoutUrl: order.approveUrl, providerRef: order.orderId };
}

// Fallback capture for the PayPal return-URL flow: if the webhook hasn't
// landed yet by the time the giver is redirected back, capture here so the
// donation confirms without waiting on the webhook. Idempotent — the
// webhook may also capture-confirm the same order; both paths converge on
// the same donation row via providerTransactionId.
router.post("/giving/paypal/capture", requireAuth, async (req, res): Promise<void> => {
  const orderId = typeof req.body?.orderId === "string" ? req.body.orderId : "";
  if (!orderId) { res.status(400).json({ error: "orderId is required." }); return; }

  const [donation] = await db.select().from(donationsTable)
    .where(and(eq(donationsTable.providerTransactionId, orderId), eq(donationsTable.memberId, req.localUserId)));
  if (!donation) { res.status(404).json({ error: "Donation not found for this order." }); return; }

  try {
    const capture = await capturePaypalOrder(orderId);
    const status = typeof capture.status === "string" ? capture.status : "";
    if (status === "COMPLETED" && donation.paymentStatus === "pending") {
      await db.update(donationsTable).set({ paymentStatus: "succeeded", rawProviderPayload: capture }).where(eq(donationsTable.id, donation.id));
    }
    res.json({ status });
  } catch (error) {
    res.status(502).json({ error: error instanceof Error ? error.message : "PayPal capture failed." });
  }
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

function receiptHtml({ user, donations, year }: { user: NonNullable<Awaited<ReturnType<typeof getUser>>>; donations: Donation[]; year: number }) {
  const total = donations.reduce((sum, donation) => sum + donation.amountCents, 0);
  const deductible = donations.filter((donation) => donation.taxDeductible).reduce((sum, donation) => sum + donation.amountCents, 0);
  const rows = donations.map((donation) => `<tr><td>${donation.donationDate.toLocaleDateString()}</td><td>${dollars(donation.amountCents)}</td><td>${donation.givingCategory}</td><td>${donation.campaignId ?? ""}</td></tr>`).join("");
  return `<!doctype html><html><head><title>${year} Giving Receipt</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#111}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}.total{font-weight:700}</style></head><body><h1>Church OS Giving Receipt</h1><p>Church address: On file<br/>Church EIN/Tax ID: On file</p><h2>${user.firstName} ${user.lastName}</h2><p>${user.email}</p><p>Donation year: ${year}</p><table><thead><tr><th>Date</th><th>Amount</th><th>Category</th><th>Campaign</th></tr></thead><tbody>${rows}</tbody></table><p class="total">Total giving: ${dollars(total)}</p><p class="total">Tax-deductible total: ${dollars(deductible)}</p><p>Generated: ${new Date().toLocaleDateString()}</p><p>No goods or services were provided in exchange for these contributions, other than intangible religious benefits.</p></body></html>`;
}

export default router;
