import { and, count, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  attendanceRecordsTable,
  attendanceSessionsTable,
  checkinRecordsTable,
  childrenTable,
  db,
  donationsTable,
  givingCampaignsTable,
  usersTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/auth";

const router: IRouter = Router();

async function getChurchId(userId: number): Promise<number | null> {
  const [user] = await db
    .select({ churchId: usersTable.churchId })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user?.churchId ?? null;
}

router.get("/admin/dashboard/summary", requireRole("admin"), async (req, res): Promise<void> => {
  const churchId = await getChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "Requester not found." }); return; }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    [totalMembersRow],
    [newMembersRow],
    [visitorsRow],
    [memberCountRow],
    mtdDonations,
    [activeCampaignsRow],
    [checkedInRow],
    trendSessions,
    givingTrendSessions,
    recentNewMembers,
  ] = await Promise.all([
    db.select({ c: count() }).from(usersTable).where(and(eq(usersTable.churchId, churchId), eq(usersTable.role, "member"))),
    db.select({ c: count() }).from(usersTable).where(and(eq(usersTable.churchId, churchId), eq(usersTable.role, "member"), gte(usersTable.createdAt, thirtyDaysAgo))),
    db.select({ c: count() }).from(usersTable).where(and(eq(usersTable.churchId, churchId), eq(usersTable.role, "member"), eq(usersTable.memberStatus, "visitor"))),
    db.select({ c: count() }).from(usersTable).where(and(
      eq(usersTable.churchId, churchId),
      eq(usersTable.role, "member"),
      inArray(usersTable.memberStatus, ["member", "active_member"]),
    )),
    db.select({ amountCents: donationsTable.amountCents }).from(donationsTable).where(and(eq(donationsTable.churchId, churchId), eq(donationsTable.paymentStatus, "succeeded"), gte(donationsTable.createdAt, startOfMonth))),
    db.select({ c: count() }).from(givingCampaignsTable).where(and(eq(givingCampaignsTable.churchId, churchId), eq(givingCampaignsTable.status, "active"))),
    db.select({ c: count() }).from(checkinRecordsTable).innerJoin(childrenTable, eq(checkinRecordsTable.childId, childrenTable.id)).where(and(eq(childrenTable.churchId, churchId), eq(checkinRecordsTable.status, "active"), gte(checkinRecordsTable.checkinTime, startOfToday), isNull(checkinRecordsTable.checkoutTime))),
    db.select({
      id: attendanceSessionsTable.id,
      sessionName: attendanceSessionsTable.sessionName,
      sessionDate: attendanceSessionsTable.sessionDate,
      attendanceType: attendanceSessionsTable.attendanceType,
    }).from(attendanceSessionsTable).where(eq(attendanceSessionsTable.churchId, churchId)).orderBy(desc(attendanceSessionsTable.sessionDate)).limit(8),
    db.select({ id: attendanceSessionsTable.id, sessionName: attendanceSessionsTable.sessionName, sessionDate: attendanceSessionsTable.sessionDate })
      .from(attendanceSessionsTable).where(and(eq(attendanceSessionsTable.churchId, churchId), eq(attendanceSessionsTable.attendanceType, "regular_service"))).orderBy(desc(attendanceSessionsTable.sessionDate)).limit(8),
    db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, memberStatus: usersTable.memberStatus, ministryDepartment: usersTable.ministryDepartment, createdAt: usersTable.createdAt })
      .from(usersTable).where(and(eq(usersTable.churchId, churchId), eq(usersTable.role, "member"), gte(usersTable.createdAt, thirtyDaysAgo))).orderBy(desc(usersTable.createdAt)).limit(8),
  ]);

  const memberCount = Number(memberCountRow?.c ?? 0);
  const givingMtdCents = mtdDonations.reduce((sum, d) => sum + d.amountCents, 0);

  const trendSessionIds = trendSessions.map((s) => s.id);
  const trendRecords = trendSessionIds.length > 0
    ? await db
        .select({ sessionId: attendanceRecordsTable.sessionId, attendanceStatus: attendanceRecordsTable.attendanceStatus })
        .from(attendanceRecordsTable)
        .where(inArray(attendanceRecordsTable.sessionId, trendSessionIds))
    : [];

  const presentBySession = new Map<number, number>();
  for (const r of trendRecords) {
    if (r.attendanceStatus === "present") {
      presentBySession.set(r.sessionId, (presentBySession.get(r.sessionId) ?? 0) + 1);
    }
  }

  const recentSessionIds = new Set(trendSessions.slice(0, 4).map((s) => s.id));
  const recentPresent = trendRecords.filter((r) => recentSessionIds.has(r.sessionId) && r.attendanceStatus === "present").length;
  const attendanceRateLast4 = recentSessionIds.size > 0 && memberCount > 0
    ? Math.round((recentPresent / (memberCount * recentSessionIds.size)) * 100)
    : null;

  const attendanceTrend = [...trendSessions].reverse().map((session) => ({
    sessionName: session.sessionName,
    sessionDate: session.sessionDate.toISOString(),
    attendanceType: session.attendanceType,
    present: presentBySession.get(session.id) ?? 0,
    memberCount,
  }));

  const orderedGivingSessions = [...givingTrendSessions].reverse();
  let givingTrend: Array<{ sessionName: string; sessionDate: string; totalCents: number }> = [];
  if (orderedGivingSessions.length > 0) {
    const minDate = orderedGivingSessions[0].sessionDate;
    const maxDate = new Date(orderedGivingSessions[orderedGivingSessions.length - 1].sessionDate);
    maxDate.setDate(maxDate.getDate() + 1);
    const sessionDonations = await db
      .select({ donationDate: donationsTable.donationDate, amountCents: donationsTable.amountCents })
      .from(donationsTable)
      .where(and(
        eq(donationsTable.churchId, churchId),
        eq(donationsTable.paymentStatus, "succeeded"),
        gte(donationsTable.donationDate, minDate),
        lte(donationsTable.donationDate, maxDate),
      ));
    givingTrend = orderedGivingSessions.map((session) => {
      const sessionDateStr = session.sessionDate.toDateString();
      const totalCents = sessionDonations
        .filter((d) => new Date(d.donationDate).toDateString() === sessionDateStr)
        .reduce((sum, d) => sum + d.amountCents, 0);
      return {
        sessionName: session.sessionName,
        sessionDate: session.sessionDate.toISOString(),
        totalCents,
      };
    });
  }

  res.json({
    totalMembers: Number(totalMembersRow?.c ?? 0),
    newMembersLast30Days: Number(newMembersRow?.c ?? 0),
    visitors: Number(visitorsRow?.c ?? 0),
    givingMtdCents,
    activeCampaigns: Number(activeCampaignsRow?.c ?? 0),
    checkedInChildren: Number(checkedInRow?.c ?? 0),
    attendanceRateLast4,
    attendanceTrend,
    givingTrend,
    recentNewMembers: recentNewMembers.map((m) => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      memberStatus: m.memberStatus,
      ministryDepartment: m.ministryDepartment,
      createdAt: m.createdAt.toISOString(),
    })),
    lastUpdated: now.toISOString(),
  });
});

export default router;
