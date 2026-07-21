import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  donationsTable,
  unmatchedDonationsTable,
  usersTable,
  PAYMENT_METHODS,
  UNMATCHED_STATUSES,
  type UnmatchedDonation,
} from "@workspace/db";
import { writeAudit } from "../../lib/payments/audit";
import { AUTO_MATCH_THRESHOLD, SUGGEST_THRESHOLD, runMatcher, saveAliasesFromTx } from "../../lib/payments/matching";
import { cents, enumValue, positiveIntegerOrNull, requireGivingManagement, serializeDonation, textOrNull } from "./shared";

const router: IRouter = Router();
const RESOLVE_ACTIONS = new Set(["link", "visitor", "anonymous", "ignore", "duplicate"]);
const REPORTABLE_METHODS = new Set<string>(PAYMENT_METHODS);

function serializeUnmatched(row: UnmatchedDonation) {
  return {
    id: row.id,
    paymentMethod: row.paymentMethod,
    amountCents: row.amountCents,
    currency: row.currency,
    transactionDate: row.transactionDate.toISOString(),
    senderName: row.senderName,
    senderEmail: row.senderEmail,
    senderPhone: row.senderPhone,
    senderHandle: row.senderHandle,
    memo: row.memo,
    givingCategory: row.givingCategory,
    status: row.status,
    suggestedMatches: row.suggestedMatches,
    resolvedDonationId: row.resolvedDonationId,
    createdAt: row.createdAt.toISOString(),
  };
}

// Report a raw external transaction (e.g. copied from a bank/Zelle/Cash App
// notification) so the matcher can auto-link it or queue it for review.
router.post("/admin/giving/unmatched", requireGivingManagement, async (req, res): Promise<void> => {
  const amountCents = cents(req.body?.amount);
  if (amountCents <= 0) { res.status(400).json({ error: "Amount must be greater than $0." }); return; }
  const paymentMethod = enumValue(req.body?.paymentMethod, REPORTABLE_METHODS, "zelle");
  const transactionDate = req.body?.transactionDate ? new Date(req.body.transactionDate) : new Date();
  if (isNaN(transactionDate.getTime())) { res.status(400).json({ error: "Transaction date is invalid." }); return; }

  const senderName = textOrNull(req.body?.senderName);
  const senderEmail = textOrNull(req.body?.senderEmail);
  const senderPhone = textOrNull(req.body?.senderPhone);
  const senderHandle = textOrNull(req.body?.senderHandle);
  const memo = textOrNull(req.body?.memo);

  const matches = await runMatcher(req.localChurchId, {
    amountCents,
    date: transactionDate,
    senderName,
    senderEmail,
    senderPhone,
    senderHandle,
    memo,
  });

  const best = matches[0] ?? null;

  if (best && best.confidence >= AUTO_MATCH_THRESHOLD) {
    const [member] = await db.select().from(usersTable).where(and(eq(usersTable.id, best.memberId), eq(usersTable.churchId, req.localChurchId)));
    const [donation] = await db.insert(donationsTable).values({
      churchId: req.localChurchId,
      memberId: best.memberId,
      donorName: member ? `${member.firstName} ${member.lastName}` : senderName,
      donorEmail: member?.email ?? senderEmail,
      amountCents,
      donationDate: transactionDate,
      donationType: "one_time",
      givingCategory: enumValue(req.body?.givingCategory, new Set(["love_offering", "tithe", "kingdom_commitment", "giftings"]), "tithe"),
      paymentMethod,
      matchConfidence: best.confidence,
      matchedByUserId: req.localUserId,
      paymentStatus: "succeeded",
      taxDeductible: true,
    }).returning();

    // Every identifier on this transaction is now permanently linked to the
    // member, so a future gift from the same email/phone/handle/name
    // auto-matches without review, even if today's match came from a
    // different identifier (e.g. name matched but email is new).
    await saveAliasesFromTx({
      churchId: req.localChurchId,
      memberId: best.memberId,
      method: paymentMethod,
      tx: { amountCents, date: transactionDate, senderName, senderEmail, senderPhone, senderHandle },
      actorUserId: req.localUserId,
    });

    res.status(201).json({ autoMatched: true, confidence: best.confidence, reasons: best.reasons, donation: serializeDonation(donation) });
    return;
  }

  const suggested = matches.filter((m) => m.confidence >= SUGGEST_THRESHOLD).slice(0, 5);
  const [queued] = await db.insert(unmatchedDonationsTable).values({
    churchId: req.localChurchId,
    paymentMethod,
    amountCents,
    transactionDate,
    senderName,
    senderEmail,
    senderPhone,
    senderHandle,
    memo,
    suggestedMatches: suggested,
    status: "pending",
  }).returning();

  res.status(201).json({ autoMatched: false, unmatched: serializeUnmatched(queued) });
});

router.get("/admin/giving/unmatched", requireGivingManagement, async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : "pending";
  const filters = [eq(unmatchedDonationsTable.churchId, req.localChurchId)];
  if (UNMATCHED_STATUSES.includes(status as (typeof UNMATCHED_STATUSES)[number])) {
    filters.push(eq(unmatchedDonationsTable.status, status as (typeof UNMATCHED_STATUSES)[number]));
  }
  const rows = await db.select().from(unmatchedDonationsTable).where(and(...filters)).orderBy(desc(unmatchedDonationsTable.transactionDate));
  res.json({ items: rows.map(serializeUnmatched) });
});

router.post("/admin/giving/unmatched/:id/resolve", requireGivingManagement, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid record." }); return; }

  const [row] = await db.select().from(unmatchedDonationsTable)
    .where(and(eq(unmatchedDonationsTable.id, id), eq(unmatchedDonationsTable.churchId, req.localChurchId)));
  if (!row) { res.status(404).json({ error: "Unmatched donation not found." }); return; }
  if (row.status !== "pending") { res.status(409).json({ error: "This record has already been resolved." }); return; }

  const action = enumValue(req.body?.action, RESOLVE_ACTIONS, "");
  if (!action) { res.status(400).json({ error: "action must be link, visitor, anonymous, ignore, or duplicate." }); return; }

  const before = serializeUnmatched(row);

  if (action === "ignore" || action === "duplicate") {
    const [updated] = await db.update(unmatchedDonationsTable).set({
      status: action,
      resolvedByUserId: req.localUserId,
      resolvedAt: new Date(),
    }).where(eq(unmatchedDonationsTable.id, id)).returning();
    await writeAudit({
      churchId: req.localChurchId,
      actorUserId: req.localUserId,
      action: "unmatched_resolved",
      entityType: "unmatched_donation",
      entityId: id,
      before,
      after: serializeUnmatched(updated),
    });
    res.json({ unmatched: serializeUnmatched(updated) });
    return;
  }

  let memberId: number | null = null;
  let donorName = row.senderName;
  let donorEmail = row.senderEmail;
  const isAnonymous = action === "anonymous";

  if (action === "link") {
    memberId = positiveIntegerOrNull(req.body?.memberId);
    if (!memberId) { res.status(400).json({ error: "memberId is required to link this donation." }); return; }
    const [member] = await db.select().from(usersTable).where(and(eq(usersTable.id, memberId), eq(usersTable.churchId, req.localChurchId)));
    if (!member) { res.status(400).json({ error: "Member not found." }); return; }
    donorName = `${member.firstName} ${member.lastName}`;
    donorEmail = member.email;

    // Permanently remember every identifier on this transaction so the next
    // gift from this sender's email, phone, or handle auto-matches.
    await saveAliasesFromTx({
      churchId: req.localChurchId,
      memberId,
      method: row.paymentMethod,
      tx: {
        amountCents: row.amountCents,
        date: row.transactionDate,
        senderName: row.senderName,
        senderEmail: row.senderEmail,
        senderPhone: row.senderPhone,
        senderHandle: row.senderHandle,
      },
      actorUserId: req.localUserId,
    });
  }

  const category = enumValue(req.body?.givingCategory, new Set(["love_offering", "tithe", "kingdom_commitment", "giftings"]), row.givingCategory ?? "tithe");

  const [donation] = await db.insert(donationsTable).values({
    churchId: req.localChurchId,
    memberId,
    donorName,
    donorEmail,
    amountCents: row.amountCents,
    currency: row.currency,
    donationDate: row.transactionDate,
    donationType: "one_time",
    givingCategory: category,
    paymentMethod: row.paymentMethod,
    providerTransactionId: row.providerTransactionId,
    rawProviderPayload: row.rawDetails,
    isAnonymous,
    taxDeductible: req.body?.taxDeductible !== false,
    paymentStatus: "succeeded",
    matchedByUserId: req.localUserId,
  }).onConflictDoNothing().returning();

  const [updated] = await db.update(unmatchedDonationsTable).set({
    status: action === "anonymous" ? "anonymous" : "matched",
    resolvedDonationId: donation?.id ?? null,
    resolvedByUserId: req.localUserId,
    resolvedAt: new Date(),
  }).where(eq(unmatchedDonationsTable.id, id)).returning();

  await writeAudit({
    churchId: req.localChurchId,
    actorUserId: req.localUserId,
    action: "unmatched_resolved",
    entityType: "unmatched_donation",
    entityId: id,
    before,
    after: serializeUnmatched(updated),
  });

  res.json({ unmatched: serializeUnmatched(updated), donation: donation ? serializeDonation(donation) : null });
});

export default router;
