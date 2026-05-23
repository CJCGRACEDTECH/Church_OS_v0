import { and, count, desc, eq, gte, isNull, or } from "drizzle-orm";
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

  const [totalMembersRow] = await db
    .select({ c: count() })
    .from(usersTable)
    .where(and(eq(usersTable.churchId, churchId), eq(usersTable.role, "member")));

  const [newMembersRow] = await db
    .select({ c: count() })
    .from(usersTable)
    .where(and(
      eq(usersTable.churchId, churchId),
      eq(usersTable.role, "member"),
      gte(usersTable.createdAt, thirtyDaysAgo),
    ));

  const [visitorsRow] = await db
    .select({ c: count() })
    .from(usersTable)
    .where(and(
      eq(usersTable.churchId, churchId),
      eq(usersTable.role, "member"),
      eq(usersTable.memberStatus, "visitor"),
    ));

  const mtdDonations = await db
    .select({ amountCents: donationsTable.amountCents })
    .from(donationsTable)
    .where(and(
      eq(donationsTable.churchId, churchId),
      eq(donationsTable.paymentStatus, "succeeded"),
      gte(donationsTable.createdAt, startOfMonth),
    ));
  const givingMtdCents = mtdDonations.reduce((sum, d) => sum + d.amountCents, 0);

  const [activeCampaignsRow] = await db
    .select({ c: count() })
    .from(givingCampaignsTable)
    .where(and(eq(givingCampaignsTable.churchId, churchId), eq(givingCampaignsTable.status, "active")));

  const [checkedInRow] = await db
    .select({ c: count() })
    .from(checkinRecordsTable)
    .innerJoin(childrenTable, eq(checkinRecordsTable.childId, childrenTable.id))
    .where(and(
      eq(childrenTable.churchId, churchId),
      eq(checkinRecordsTable.status, "active"),
      gte(checkinRecordsTable.checkinTime, startOfToday),
      isNull(checkinRecordsTable.checkoutTime),
    ));

  const recentSessions = await db
    .select({ id: attendanceSessionsTable.id, sessionName: attendanceSessionsTable.sessionName, sessionDate: attendanceSessionsTable.sessionDate })
    .from(attendanceSessionsTable)
    .where(eq(attendanceSessionsTable.churchId, churchId))
    .orderBy(desc(attendanceSessionsTable.sessionDate))
    .limit(4);

  let attendanceRateLast4: number | null = null;
  if (recentSessions.length > 0) {
    const sessionIds = recentSessions.map((s) => s.id);
    const records = await db
      .select({ attendanceStatus: attendanceRecordsTable.attendanceStatus })
      .from(attendanceRecordsTable)
      .where(or(...sessionIds.map((id) => eq(attendanceRecordsTable.sessionId, id))));
    const present = records.filter((r) => r.attendanceStatus === "present").length;
    attendanceRateLast4 = records.length > 0 ? Math.round((present / records.length) * 100) : null;
  }

  const trendSessions = await db
    .select({ id: attendanceSessionsTable.id, sessionName: attendanceSessionsTable.sessionName, sessionDate: attendanceSessionsTable.sessionDate })
    .from(attendanceSessionsTable)
    .where(eq(attendanceSessionsTable.churchId, churchId))
    .orderBy(desc(attendanceSessionsTable.sessionDate))
    .limit(8);

  const trendData = await Promise.all(
    [...trendSessions].reverse().map(async (session) => {
      const sessionRecords = await db
        .select({ attendanceStatus: attendanceRecordsTable.attendanceStatus })
        .from(attendanceRecordsTable)
        .where(eq(attendanceRecordsTable.sessionId, session.id));
      return {
        sessionName: session.sessionName,
        sessionDate: session.sessionDate.toISOString(),
        present: sessionRecords.filter((r) => r.attendanceStatus === "present").length,
        total: sessionRecords.length,
      };
    }),
  );

  const recentNewMembers = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      memberStatus: usersTable.memberStatus,
      ministryDepartment: usersTable.ministryDepartment,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(and(
      eq(usersTable.churchId, churchId),
      eq(usersTable.role, "member"),
      gte(usersTable.createdAt, thirtyDaysAgo),
    ))
    .orderBy(desc(usersTable.createdAt))
    .limit(8);

  res.json({
    totalMembers: totalMembersRow?.c ?? 0,
    newMembersLast30Days: newMembersRow?.c ?? 0,
    visitors: visitorsRow?.c ?? 0,
    givingMtdCents,
    activeCampaigns: activeCampaignsRow?.c ?? 0,
    checkedInChildren: checkedInRow?.c ?? 0,
    attendanceRateLast4,
    attendanceTrend: trendData,
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
