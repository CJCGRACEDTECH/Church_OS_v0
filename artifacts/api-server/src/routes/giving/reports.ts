import { and, eq, gte, lte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, donationsTable, usersTable, type Donation } from "@workspace/db";
import { ADMIN_PERMISSIONS } from "../../lib/admin-permissions";
import { requireAdminPermission } from "../../middlewares/auth";

const router: IRouter = Router();
const requireGivingReports = requireAdminPermission(ADMIN_PERMISSIONS.GIVING_REPORTS);

function parseRange(req: { query: Record<string, unknown> }) {
  const from = typeof req.query.from === "string" && req.query.from ? new Date(req.query.from) : null;
  const to = typeof req.query.to === "string" && req.query.to ? new Date(`${req.query.to}T23:59:59.999Z`) : null;
  return {
    from: from && !isNaN(from.getTime()) ? from : null,
    to: to && !isNaN(to.getTime()) ? to : null,
  };
}

async function succeededDonations(churchId: number, from: Date | null, to: Date | null): Promise<Donation[]> {
  return db.select().from(donationsTable).where(and(
    eq(donationsTable.churchId, churchId),
    eq(donationsTable.paymentStatus, "succeeded"),
    ...(from ? [gte(donationsTable.donationDate, from)] : []),
    ...(to ? [lte(donationsTable.donationDate, to)] : []),
  ));
}

// Totals for a date range, grouped by category, method, or both.
router.get("/admin/giving/reports/summary", requireGivingReports, async (req, res) => {
  const { from, to } = parseRange(req);
  const donations = await succeededDonations(req.localChurchId, from, to);

  const groupTotals = (key: (d: Donation) => string) => {
    const groups = new Map<string, { totalCents: number; count: number }>();
    for (const donation of donations) {
      const group = groups.get(key(donation)) ?? { totalCents: 0, count: 0 };
      group.totalCents += donation.amountCents;
      group.count += 1;
      groups.set(key(donation), group);
    }
    return Array.from(groups.entries())
      .map(([groupKey, value]) => ({ key: groupKey, ...value }))
      .sort((a, b) => b.totalCents - a.totalCents);
  };

  res.json({
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
    totalCents: donations.reduce((sum, donation) => sum + donation.amountCents, 0),
    count: donations.length,
    donorsCount: new Set(donations.filter((d) => d.memberId !== null).map((d) => d.memberId)).size,
    byCategory: groupTotals((d) => d.givingCategory),
    byMethod: groupTotals((d) => d.paymentMethod),
  });
});

// Top donors for a date range; unattributed gifts are reported as one
// aggregate bucket so totals still reconcile.
router.get("/admin/giving/reports/top-donors", requireGivingReports, async (req, res) => {
  const { from, to } = parseRange(req);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const donations = await succeededDonations(req.localChurchId, from, to);

  const byMember = new Map<number, { totalCents: number; count: number; lastGift: Date }>();
  let unattributedCents = 0;
  let unattributedCount = 0;
  for (const donation of donations) {
    if (donation.memberId === null) {
      unattributedCents += donation.amountCents;
      unattributedCount += 1;
      continue;
    }
    const entry = byMember.get(donation.memberId) ?? { totalCents: 0, count: 0, lastGift: donation.donationDate };
    entry.totalCents += donation.amountCents;
    entry.count += 1;
    if (donation.donationDate > entry.lastGift) entry.lastGift = donation.donationDate;
    byMember.set(donation.memberId, entry);
  }

  const ranked = Array.from(byMember.entries())
    .sort((a, b) => b[1].totalCents - a[1].totalCents)
    .slice(0, limit);

  const members = ranked.length > 0
    ? await db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
        .from(usersTable)
        .where(eq(usersTable.churchId, req.localChurchId))
    : [];
  const memberById = new Map(members.map((member) => [member.id, member]));

  res.json({
    from: from?.toISOString() ?? null,
    to: to?.toISOString() ?? null,
    donors: ranked.map(([memberId, entry]) => {
      const member = memberById.get(memberId);
      return {
        memberId,
        name: member ? `${member.firstName} ${member.lastName}` : "Unknown member",
        email: member?.email ?? null,
        totalCents: entry.totalCents,
        giftCount: entry.count,
        lastGiftDate: entry.lastGift.toISOString(),
      };
    }),
    unattributed: { totalCents: unattributedCents, count: unattributedCount },
  });
});

export default router;
