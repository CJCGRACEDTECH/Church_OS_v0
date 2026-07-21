import { and, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, donationsTable, givingCampaignsTable, givingIntentsTable, usersTable } from "@workspace/db";
import { writeAudit } from "../../lib/payments/audit";
import { createIntent, setIntentProviderRef, setIntentStatus } from "../../lib/payments/intent";
import { createSquarePaymentLink, squareConfigured } from "../../lib/payments/providers/square";
import {
  CATEGORIES,
  PAYMENT_METHOD_VALUES,
  PAYMENT_STATUSES,
  cents,
  enumValue,
  positiveIntegerOrNull,
  requireGivingManagement,
  serializeDonation,
  textOrNull,
} from "./shared";

const router: IRouter = Router();

const MANUAL_ENTRY_METHODS = new Set(["manual", "zelle", "cash_app", "venmo", "paypal", "square"]);

async function churchMember(memberId: number, churchId: number) {
  const [member] = await db.select().from(usersTable)
    .where(and(eq(usersTable.id, memberId), eq(usersTable.churchId, churchId)));
  return member ?? null;
}

// Manual entry: record a gift that arrived outside automated checkout
// (cash, check, Zelle, direct Cash App/Venmo/PayPal, offline Square).
router.post("/admin/giving/donations", requireGivingManagement, async (req, res): Promise<void> => {
  const amountCents = cents(req.body?.amount);
  if (amountCents <= 0) { res.status(400).json({ error: "Amount must be greater than $0." }); return; }
  const paymentMethod = enumValue(req.body?.paymentMethod, MANUAL_ENTRY_METHODS, "manual");
  const category = enumValue(req.body?.givingCategory, CATEGORIES, "tithe");
  const memberId = positiveIntegerOrNull(req.body?.memberId);
  const campaignId = positiveIntegerOrNull(req.body?.campaignId);
  const donationDate = req.body?.donationDate ? new Date(req.body.donationDate) : new Date();
  if (isNaN(donationDate.getTime())) { res.status(400).json({ error: "Donation date is invalid." }); return; }

  let donorName = textOrNull(req.body?.donorName);
  let donorEmail = textOrNull(req.body?.donorEmail);
  if (memberId) {
    const member = await churchMember(memberId, req.localChurchId);
    if (!member) { res.status(400).json({ error: "Member not found." }); return; }
    donorName = donorName ?? `${member.firstName} ${member.lastName}`;
    donorEmail = donorEmail ?? member.email;
  }

  if (campaignId) {
    const [campaign] = await db.select({ id: givingCampaignsTable.id }).from(givingCampaignsTable)
      .where(and(eq(givingCampaignsTable.id, campaignId), eq(givingCampaignsTable.churchId, req.localChurchId)));
    if (!campaign) { res.status(400).json({ error: "Campaign not found." }); return; }
  }

  const [donation] = await db.insert(donationsTable).values({
    churchId: req.localChurchId,
    memberId,
    donorName,
    donorEmail,
    amountCents,
    donationDate,
    donationType: "one_time",
    givingCategory: category,
    campaignId,
    paymentMethod,
    isAnonymous: req.body?.isAnonymous === true,
    taxDeductible: req.body?.taxDeductible !== false,
    paymentStatus: "succeeded",
    matchedByUserId: req.localUserId,
  }).returning();

  await writeAudit({
    churchId: req.localChurchId,
    actorUserId: req.localUserId,
    action: "donation_created_manual",
    entityType: "donation",
    entityId: donation.id,
    after: serializeDonation(donation),
    note: textOrNull(req.body?.note),
  });

  res.status(201).json({ donation: serializeDonation(donation) });
});

// In-person card giving: creates an intent, then a Square-hosted payment
// page the giver pays on; the Square webhook completes the donation.
router.post("/admin/giving/in-person", requireGivingManagement, async (req, res): Promise<void> => {
  const amountCents = cents(req.body?.amount);
  if (amountCents < 100) { res.status(400).json({ error: "Minimum card amount is $1.00." }); return; }
  const category = enumValue(req.body?.givingCategory, CATEGORIES, "tithe");
  const memberId = positiveIntegerOrNull(req.body?.memberId);
  const campaignId = positiveIntegerOrNull(req.body?.campaignId);

  let donorName = textOrNull(req.body?.donorName);
  let donorEmail: string | null = null;
  if (memberId) {
    const member = await churchMember(memberId, req.localChurchId);
    if (!member) { res.status(400).json({ error: "Member not found." }); return; }
    donorName = `${member.firstName} ${member.lastName}`;
    donorEmail = member.email;
  }

  if (!squareConfigured()) {
    res.json({ setupRequired: true, message: "Square is not connected yet. Add SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID to enable in-person card giving." });
    return;
  }

  const intent = await createIntent({
    churchId: req.localChurchId,
    memberId,
    donorName,
    donorEmail,
    amountCents,
    givingCategory: category,
    campaignId,
    paymentMethod: "square",
    donationType: "one_time",
    status: "pending",
    createdByUserId: req.localUserId,
  });

  let link: Awaited<ReturnType<typeof createSquarePaymentLink>>;
  try {
    link = await createSquarePaymentLink({ intentId: intent.id, amountCents, category });
  } catch (error) {
    await setIntentStatus(intent.id, "failed");
    throw error;
  }
  if (link.setupRequired) {
    await setIntentStatus(intent.id, "cancelled");
    res.json({ setupRequired: true, message: link.message });
    return;
  }
  if (link.orderId) await setIntentProviderRef(intent.id, link.orderId);

  res.status(201).json({ intentId: intent.id, paymentUrl: link.url });
});

// Poll an intent while waiting for the Square webhook to complete it.
router.get("/admin/giving/intents/:id", requireGivingManagement, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid intent." }); return; }
  const [intent] = await db.select().from(givingIntentsTable)
    .where(and(eq(givingIntentsTable.id, id), eq(givingIntentsTable.churchId, req.localChurchId)));
  if (!intent) { res.status(404).json({ error: "Intent not found." }); return; }
  res.json({ intent: { id: intent.id, status: intent.status, amountCents: intent.amountCents, paymentMethod: intent.paymentMethod } });
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
    donorsCount: new Set(succeeded.filter((donation) => donation.memberId !== null).map((donation) => donation.memberId)).size,
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
  const method = typeof req.query.method === "string" ? req.query.method : "";
  const filters = [
    eq(donationsTable.churchId, req.localChurchId),
    ...(search ? [or(ilike(donationsTable.donorName, `%${search}%`), ilike(donationsTable.donorEmail, `%${search}%`))] : []),
    ...(fromDate ? [gte(donationsTable.donationDate, new Date(fromDate))] : year ? [gte(donationsTable.donationDate, new Date(`${year}-01-01T00:00:00Z`))] : []),
    ...(toDate ? [lte(donationsTable.donationDate, new Date(`${toDate}T23:59:59Z`))] : year ? [lte(donationsTable.donationDate, new Date(`${year}-12-31T23:59:59Z`))] : []),
    ...(CATEGORIES.has(category) ? [eq(donationsTable.givingCategory, category as typeof donationsTable.$inferSelect.givingCategory)] : []),
    ...(PAYMENT_STATUSES.has(status) ? [eq(donationsTable.paymentStatus, status as typeof donationsTable.$inferSelect.paymentStatus)] : []),
    ...(PAYMENT_METHOD_VALUES.has(method) ? [eq(donationsTable.paymentMethod, method as typeof donationsTable.$inferSelect.paymentMethod)] : []),
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

router.get("/admin/giving/export.csv", requireGivingManagement, async (req, res) => {
  const rows = await db
    .select({
      id: donationsTable.id,
      donorName: donationsTable.donorName,
      donorEmail: donationsTable.donorEmail,
      amountCents: donationsTable.amountCents,
      donationDate: donationsTable.donationDate,
      donationType: donationsTable.donationType,
      givingCategory: donationsTable.givingCategory,
      paymentMethod: donationsTable.paymentMethod,
      paymentStatus: donationsTable.paymentStatus,
      taxDeductible: donationsTable.taxDeductible,
      receiptIssued: donationsTable.receiptIssued,
      campaignName: givingCampaignsTable.campaignName,
    })
    .from(donationsTable)
    .leftJoin(givingCampaignsTable, eq(donationsTable.campaignId, givingCampaignsTable.id))
    .where(eq(donationsTable.churchId, req.localChurchId))
    .orderBy(desc(donationsTable.donationDate));
  const csvRows = ["Donation ID,Donor Name,Donor Email,Amount,Date,Type,Category,Method,Campaign,Status,Tax Deductible,Receipt Issued"];
  rows.forEach((row) => csvRows.push([
    row.id,
    JSON.stringify(row.donorName ?? ""),
    row.donorEmail ?? "",
    (row.amountCents / 100).toFixed(2),
    row.donationDate.toISOString(),
    row.donationType,
    row.givingCategory,
    row.paymentMethod,
    JSON.stringify(row.campaignName ?? ""),
    row.paymentStatus,
    row.taxDeductible ? "yes" : "no",
    row.receiptIssued ? "yes" : "no",
  ].join(",")));
  res.setHeader("content-type", "text/csv");
  res.setHeader("content-disposition", "attachment; filename=giving-records.csv");
  res.send(csvRows.join("\n"));
});

export default router;
