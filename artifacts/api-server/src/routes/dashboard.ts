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
  systemSettingsTable,
  usersTable,
} from "@workspace/db";
import { getDiscipleMembers } from "../lib/discipleship";
import { getActiveMemberIdsForMonth } from "../lib/member-engagement";
import { requireRole } from "../middlewares/auth";
import { ADMIN_PERMISSIONS, getStoredAdminPermissions, isAdminLevel } from "../lib/admin-permissions";

const router: IRouter = Router();
const DEFAULT_MONTHLY_GIVING_GOAL_CENTS = 25000000;

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function monthlyGoalCents(settings: unknown, key: string) {
  const giving = objectValue(settings);
  const records = Array.isArray(giving.monthlyGivingGoals) ? giving.monthlyGivingGoals : [];
  const current = records.find((record) => {
    const item = objectValue(record);
    return item.month === key;
  });
  const currentGoal = objectValue(current).goalCents;
  if (typeof currentGoal === "number" && Number.isFinite(currentGoal)) return Math.max(0, currentGoal);
  const fallback = giving.monthlyGivingGoalCents;
  return typeof fallback === "number" && Number.isFinite(fallback) ? Math.max(0, fallback) : DEFAULT_MONTHLY_GIVING_GOAL_CENTS;
}

async function getChurchId(userId: number): Promise<number | null> {
  const [user] = await db
    .select({ churchId: usersTable.churchId })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user?.churchId ?? null;
}

router.get("/admin/dashboard/summary", requireRole("admin"), async (req, res): Promise<void> => {
  const [requester] = await db
    .select({ adminLevel: usersTable.adminLevel })
    .from(usersTable)
    .where(eq(usersTable.id, req.localUserId));
  const requesterPermissions = await getStoredAdminPermissions(
    req.localUserId,
    isAdminLevel(requester?.adminLevel) ? requester.adminLevel : null,
  );
  if (requesterPermissions.length === 1 && requesterPermissions.includes(ADMIN_PERMISSIONS.ATTENDANCE_CHECKIN)) {
    res.status(403).json({ error: "Dashboard access is not available for Children Ministry-only admins." });
    return;
  }

  const canSeeGiving = requesterPermissions.includes(ADMIN_PERMISSIONS.GIVING_MANAGEMENT)
    || requesterPermissions.includes(ADMIN_PERMISSIONS.GIVING_SUMMARY);
  const canSeeMembers = requesterPermissions.includes(ADMIN_PERMISSIONS.MEMBER_DIRECTORY);
  const canSeeAttendance = requesterPermissions.includes(ADMIN_PERMISSIONS.ATTENDANCE_MANAGEMENT);
  const canSeeChildren = requesterPermissions.includes(ADMIN_PERMISSIONS.ATTENDANCE_CHECKIN);

  const churchId = await getChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "Requester not found." }); return; }

  const now = new Date();
  const yearStart = new Date(`${now.getFullYear()}-01-01T00:00:00Z`);
  const givingMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    [totalMembersRow],
    [newMembersRow],
    [visitorsRow],
    memberRows,
    ytdDonations,
    [activeCampaignsRow],
    [checkedInRow],
    [totalChildrenRow],
    regularTrendSessions,
    discipleshipTrendSessions,
    givingTrendSessions,
    childrenCheckinRows,
    recentNewMembers,
    [givingSettingsRow],
  ] = await Promise.all([
    canSeeMembers
      ? db.select({ c: count() }).from(usersTable).where(and(
          eq(usersTable.churchId, churchId),
          inArray(usersTable.role, ["member", "admin"]),
          inArray(usersTable.memberStatus, ["member", "active_member"]),
        ))
      : Promise.resolve([{ c: 0 }]),
    canSeeMembers
      ? db.select({ c: count() }).from(usersTable).where(and(
          eq(usersTable.churchId, churchId),
          inArray(usersTable.role, ["member", "admin"]),
          inArray(usersTable.memberStatus, ["member", "active_member"]),
          gte(usersTable.createdAt, thirtyDaysAgo),
        ))
      : Promise.resolve([{ c: 0 }]),
    canSeeMembers
      ? db.select({ c: count() }).from(usersTable).where(and(eq(usersTable.churchId, churchId), eq(usersTable.role, "member"), eq(usersTable.memberStatus, "visitor")))
      : Promise.resolve([{ c: 0 }]),
    canSeeAttendance
      ? db.select({
          id: usersTable.id,
          memberStatus: usersTable.memberStatus,
          servingStatus: usersTable.servingStatus,
        }).from(usersTable).where(and(
          eq(usersTable.churchId, churchId),
          inArray(usersTable.role, ["member", "admin"]),
          inArray(usersTable.memberStatus, ["member", "active_member"]),
        ))
      : Promise.resolve([] as Array<{ id: number; memberStatus: typeof usersTable.$inferSelect.memberStatus; servingStatus: typeof usersTable.$inferSelect.servingStatus }>),
    canSeeGiving
      ? db.select({ amountCents: donationsTable.amountCents, donationDate: donationsTable.donationDate })
          .from(donationsTable)
          .where(and(
            eq(donationsTable.churchId, churchId),
            eq(donationsTable.paymentStatus, "succeeded"),
            gte(donationsTable.donationDate, yearStart),
          ))
      : Promise.resolve([] as Array<{ amountCents: number; donationDate: Date }>),
    canSeeGiving
      ? db.select({ c: count() }).from(givingCampaignsTable).where(and(eq(givingCampaignsTable.churchId, churchId), eq(givingCampaignsTable.status, "active")))
      : Promise.resolve([{ c: 0 as number }]),
    canSeeChildren
      ? db.select({ c: count() }).from(checkinRecordsTable).innerJoin(childrenTable, eq(checkinRecordsTable.childId, childrenTable.id)).where(and(eq(childrenTable.churchId, churchId), eq(checkinRecordsTable.status, "active"), gte(checkinRecordsTable.checkinTime, startOfToday), isNull(checkinRecordsTable.checkoutTime)))
      : Promise.resolve([{ c: 0 as number }]),
    canSeeChildren
      ? db.select({ c: count() }).from(childrenTable).where(eq(childrenTable.churchId, churchId))
      : Promise.resolve([{ c: 0 as number }]),
    canSeeAttendance
      ? db.select({
          id: attendanceSessionsTable.id,
          sessionName: attendanceSessionsTable.sessionName,
          sessionDate: attendanceSessionsTable.sessionDate,
          attendanceType: attendanceSessionsTable.attendanceType,
        }).from(attendanceSessionsTable).where(and(eq(attendanceSessionsTable.churchId, churchId), eq(attendanceSessionsTable.attendanceType, "regular_service"))).orderBy(desc(attendanceSessionsTable.sessionDate)).limit(8)
      : Promise.resolve([] as Array<{ id: number; sessionName: string; sessionDate: Date; attendanceType: typeof attendanceSessionsTable.$inferSelect.attendanceType }>),
    canSeeAttendance
      ? db.select({
          id: attendanceSessionsTable.id,
          sessionName: attendanceSessionsTable.sessionName,
          sessionDate: attendanceSessionsTable.sessionDate,
          attendanceType: attendanceSessionsTable.attendanceType,
        }).from(attendanceSessionsTable).where(and(eq(attendanceSessionsTable.churchId, churchId), eq(attendanceSessionsTable.attendanceType, "discipleship"))).orderBy(desc(attendanceSessionsTable.sessionDate)).limit(8)
      : Promise.resolve([] as Array<{ id: number; sessionName: string; sessionDate: Date; attendanceType: typeof attendanceSessionsTable.$inferSelect.attendanceType }>),
    canSeeGiving
      ? db.select({ id: attendanceSessionsTable.id, sessionName: attendanceSessionsTable.sessionName, sessionDate: attendanceSessionsTable.sessionDate })
          .from(attendanceSessionsTable).where(and(eq(attendanceSessionsTable.churchId, churchId), eq(attendanceSessionsTable.attendanceType, "regular_service"))).orderBy(desc(attendanceSessionsTable.sessionDate)).limit(8)
      : Promise.resolve([] as Array<{ id: number; sessionName: string; sessionDate: Date }>),
    canSeeChildren
      ? db.select({
          childId: checkinRecordsTable.childId,
          checkinTime: checkinRecordsTable.checkinTime,
        })
          .from(checkinRecordsTable)
          .innerJoin(childrenTable, eq(checkinRecordsTable.childId, childrenTable.id))
          .where(eq(childrenTable.churchId, churchId))
          .orderBy(desc(checkinRecordsTable.checkinTime))
          .limit(500)
      : Promise.resolve([] as Array<{ childId: number; checkinTime: Date }>),
    canSeeMembers
      ? db.select({ id: usersTable.id, firstName: usersTable.firstName, lastName: usersTable.lastName, memberStatus: usersTable.memberStatus, ministryDepartment: usersTable.ministryDepartment, createdAt: usersTable.createdAt })
          .from(usersTable).where(and(eq(usersTable.churchId, churchId), inArray(usersTable.role, ["member", "admin"]), gte(usersTable.createdAt, thirtyDaysAgo))).orderBy(desc(usersTable.createdAt)).limit(8)
      : Promise.resolve([] as Array<{ id: number; firstName: string; lastName: string; memberStatus: typeof usersTable.$inferSelect.memberStatus; ministryDepartment: string | null; createdAt: Date }>),
    canSeeGiving
      ? db.select({ settings: systemSettingsTable.settings })
          .from(systemSettingsTable)
          .where(and(eq(systemSettingsTable.churchId, churchId), eq(systemSettingsTable.settingGroup, "giving")))
      : Promise.resolve([undefined]),
  ]);

  const memberCount = memberRows.length;
  const activeMemberIds = await getActiveMemberIdsForMonth(churchId, now);
  const activeMembers = activeMemberIds.size;
  const givingYtdCents = ytdDonations.reduce((sum, d) => sum + d.amountCents, 0);
  const givingMtdCents = ytdDonations
    .filter((donation) => donation.donationDate >= givingMonthStart)
    .reduce((sum, d) => sum + d.amountCents, 0);
  const givingMonthlyGoalCents = monthlyGoalCents(givingSettingsRow?.settings, monthKey(now));
  const givingMonthlyGoalPercent = givingMonthlyGoalCents > 0
    ? Math.min(Math.round((givingMtdCents / givingMonthlyGoalCents) * 100), 999)
    : 0;

  const childrenByDate = new Map<string, Set<number>>();
  for (const row of childrenCheckinRows) {
    const key = dateKey(row.checkinTime);
    const childIds = childrenByDate.get(key) ?? new Set<number>();
    childIds.add(row.childId);
    childrenByDate.set(key, childIds);
  }
  const recentChildrenCheckinDates = [...childrenByDate.keys()]
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .slice(0, 8);
  const latestChildrenAttendance = recentChildrenCheckinDates[0]
    ? (childrenByDate.get(recentChildrenCheckinDates[0])?.size ?? 0)
    : 0;
  const averageChildrenCheckedIn = recentChildrenCheckinDates.length > 0
    ? Math.round(recentChildrenCheckinDates.reduce((sum, key) => sum + (childrenByDate.get(key)?.size ?? 0), 0) / recentChildrenCheckinDates.length)
    : 0;
  const totalChildren = Number(totalChildrenRow?.c ?? 0);
  const childrenAttendanceRate = totalChildren > 0
    ? Math.round((averageChildrenCheckedIn / totalChildren) * 100)
    : 0;

  const discipleMembers = await getDiscipleMembers(churchId);
  const totalTaggedDisciples = discipleMembers.length;

  const regularTrendSessionIds = regularTrendSessions.map((s) => s.id);
  const discipleshipTrendSessionIds = discipleshipTrendSessions.map((s) => s.id);
  const trendSessionIds = [...new Set([...regularTrendSessionIds, ...discipleshipTrendSessionIds])];
  const trendRecords = trendSessionIds.length > 0
    ? await db
        .select({ sessionId: attendanceRecordsTable.sessionId, attendanceStatus: attendanceRecordsTable.attendanceStatus, memberId: attendanceRecordsTable.memberId })
        .from(attendanceRecordsTable)
        .where(inArray(attendanceRecordsTable.sessionId, trendSessionIds))
    : [];
  const trendMemberIds = [...new Set(trendRecords.map((record) => record.memberId))];
  const trendMembers = trendMemberIds.length > 0
    ? await db
        .select({ id: usersTable.id, memberStatus: usersTable.memberStatus })
        .from(usersTable)
        .where(and(eq(usersTable.churchId, churchId), inArray(usersTable.id, trendMemberIds)))
    : [];
  const memberStatusById = new Map(trendMembers.map((member) => [member.id, member.memberStatus]));

  const presentBySession = new Map<number, number>();
  const serviceBreakdownBySession = new Map<number, { activeMember: number; member: number; visitor: number }>();
  const discipleIds = new Set(discipleMembers.map((member) => member.id));
  const disciplesPresentBySession = new Map<number, number>();
  for (const r of trendRecords) {
    if (r.attendanceStatus === "present") {
      presentBySession.set(r.sessionId, (presentBySession.get(r.sessionId) ?? 0) + 1);
      const memberStatus = memberStatusById.get(r.memberId);
      const category = memberStatus === "visitor"
        ? "visitor"
        : activeMemberIds.has(r.memberId) || memberStatus === "active_member"
          ? "activeMember"
          : "member";
      const breakdown = serviceBreakdownBySession.get(r.sessionId) ?? { activeMember: 0, member: 0, visitor: 0 };
      breakdown[category] += 1;
      serviceBreakdownBySession.set(r.sessionId, breakdown);
      if (discipleIds.has(r.memberId)) {
        disciplesPresentBySession.set(r.sessionId, (disciplesPresentBySession.get(r.sessionId) ?? 0) + 1);
      }
    }
  }

  const recentServiceSessionIds = new Set(regularTrendSessions.slice(0, 4).map((s) => s.id));
  const recentPresent = trendRecords.filter((r) => recentServiceSessionIds.has(r.sessionId) && r.attendanceStatus === "present").length;
  const attendanceRateLast4 = recentServiceSessionIds.size > 0 && memberCount > 0
    ? Math.round((recentPresent / (memberCount * recentServiceSessionIds.size)) * 100)
    : null;

  const orderedRegularTrendSessions = [...regularTrendSessions].reverse();
  const orderedDiscipleshipTrendSessions = [...discipleshipTrendSessions].reverse();
  const regularAttendanceTrend = orderedRegularTrendSessions.map((session) => ({
    sessionId: session.id,
    sessionName: session.sessionName,
    sessionDate: session.sessionDate.toISOString(),
    attendanceType: "regular_service",
    present: presentBySession.get(session.id) ?? 0,
    memberCount,
    breakdown: serviceBreakdownBySession.get(session.id) ?? { activeMember: 0, member: 0, visitor: 0 },
  }));
  const discipleshipAttendanceTrend = orderedDiscipleshipTrendSessions.map((session) => {
    const checkedInDisciples = disciplesPresentBySession.get(session.id) ?? 0;
    return {
      sessionId: session.id,
      sessionName: session.sessionName,
      sessionDate: session.sessionDate.toISOString(),
      attendanceType: "discipleship",
      present: checkedInDisciples,
      memberCount: totalTaggedDisciples,
      checkedInDisciples,
      totalTaggedDisciples,
      attendanceRate: totalTaggedDisciples > 0 ? Math.round((checkedInDisciples / totalTaggedDisciples) * 100) : 0,
    };
  });
  const attendanceTrend = [...regularAttendanceTrend, ...discipleshipAttendanceTrend];

  const regularLatest = regularTrendSessions[0];
  const latestRegularCount = regularLatest ? (presentBySession.get(regularLatest.id) ?? 0) : 0;
  const regularAveragePerSession = regularTrendSessions.length > 0
    ? Math.round(regularTrendSessions.reduce((sum, session) => sum + (presentBySession.get(session.id) ?? 0), 0) / regularTrendSessions.length)
    : 0;
  const regularAverageAttendanceRate = memberCount > 0
    ? Math.round((regularAveragePerSession / memberCount) * 100)
    : 0;

  const discipleshipLatest = discipleshipTrendSessions[0];
  const latestCheckedIn = discipleshipLatest ? (disciplesPresentBySession.get(discipleshipLatest.id) ?? 0) : 0;
  const latestAttendanceRate = totalTaggedDisciples > 0 ? Math.round((latestCheckedIn / totalTaggedDisciples) * 100) : 0;
  const discipleshipAveragePerSession = discipleshipTrendSessions.length > 0
    ? Math.round(discipleshipTrendSessions.reduce((sum, session) => sum + (disciplesPresentBySession.get(session.id) ?? 0), 0) / discipleshipTrendSessions.length)
    : 0;

  const orderedGivingSessions = [...givingTrendSessions].reverse();
  let givingTrend: Array<{ sessionName: string; sessionDate: string; totalCents: number }> = [];
  let givingByServiceLast8: Array<{
    sessionId: number;
    sessionName: string;
    sessionDate: string;
    totalGiving: number;
    tithe: number;
    giftOffering: number;
    buildingFund: number;
  }> = [];
  if (orderedGivingSessions.length > 0) {
    const serviceSessionIds = orderedGivingSessions.map((session) => session.id);
    const minDate = orderedGivingSessions[0].sessionDate;
    const maxDate = new Date(orderedGivingSessions[orderedGivingSessions.length - 1].sessionDate);
    maxDate.setDate(maxDate.getDate() + 1);
    const linkedSessionDonations = serviceSessionIds.length > 0 ? await db
      .select({
        serviceSessionId: donationsTable.serviceSessionId,
        donationDate: donationsTable.donationDate,
        amountCents: donationsTable.amountCents,
        givingCategory: donationsTable.givingCategory,
      })
      .from(donationsTable)
      .where(and(
        eq(donationsTable.churchId, churchId),
        eq(donationsTable.paymentStatus, "succeeded"),
        inArray(donationsTable.serviceSessionId, serviceSessionIds),
      )) : [];
    const legacyUnlinkedDonations = await db
      .select({
        serviceSessionId: donationsTable.serviceSessionId,
        donationDate: donationsTable.donationDate,
        amountCents: donationsTable.amountCents,
        givingCategory: donationsTable.givingCategory,
      })
      .from(donationsTable)
      .where(and(
        eq(donationsTable.churchId, churchId),
        eq(donationsTable.paymentStatus, "succeeded"),
        isNull(donationsTable.serviceSessionId),
        gte(donationsTable.donationDate, minDate),
        lte(donationsTable.donationDate, maxDate),
      ));
    const donationsByServiceId = new Map<number, typeof linkedSessionDonations>();
    for (const donation of linkedSessionDonations) {
      if (!donation.serviceSessionId) continue;
      const existing = donationsByServiceId.get(donation.serviceSessionId) ?? [];
      existing.push(donation);
      donationsByServiceId.set(donation.serviceSessionId, existing);
    }

    // Legacy fallback for older dev/Replit rows created before donations had service_session_id.
    // New donations should be linked directly to a service session and will skip this date match.
    const orderedServiceDates = orderedGivingSessions.map((session) => ({
      ...session,
      key: dateKey(session.sessionDate),
      time: new Date(dateKey(session.sessionDate)).getTime(),
    }));
    for (const donation of legacyUnlinkedDonations) {
      const donationTime = new Date(dateKey(new Date(donation.donationDate))).getTime();
      const matchedService = [...orderedServiceDates]
        .reverse()
        .find((session) => session.time <= donationTime);
      if (!matchedService) continue;
      const existing = donationsByServiceId.get(matchedService.id) ?? [];
      existing.push(donation);
      donationsByServiceId.set(matchedService.id, existing);
    }
    givingByServiceLast8 = orderedGivingSessions.map((session) => {
      const sessionDateStr = dateKey(session.sessionDate);
      const matching = donationsByServiceId.get(session.id) ?? [];
      const tithe = matching.filter((d) => d.givingCategory === "tithe").reduce((sum, d) => sum + d.amountCents, 0);
      const giftOffering = matching.filter((d) => d.givingCategory === "offering").reduce((sum, d) => sum + d.amountCents, 0);
      const buildingFund = matching.filter((d) => d.givingCategory === "building_fund").reduce((sum, d) => sum + d.amountCents, 0);
      const totalCents = tithe + giftOffering + buildingFund;
      return {
        sessionId: session.id,
        sessionName: session.sessionName,
        sessionDate: session.sessionDate.toISOString(),
        serviceDate: sessionDateStr,
        totalGiving: totalCents,
        tithe,
        giftOffering,
        buildingFund,
      };
    });
    givingTrend = givingByServiceLast8.map((session) => ({
      sessionName: session.sessionName,
      sessionDate: session.sessionDate,
      totalCents: session.totalGiving,
    }));
  }

  res.json({
    totalMembers: canSeeMembers ? Number(totalMembersRow?.c ?? 0) : null,
    activeMembers: canSeeMembers ? activeMembers : null,
    newMembersLast30Days: canSeeMembers ? Number(newMembersRow?.c ?? 0) : null,
    visitors: canSeeMembers ? Number(visitorsRow?.c ?? 0) : null,
    givingMtdCents: canSeeGiving ? givingMtdCents : null,
    givingYtdCents: canSeeGiving ? givingYtdCents : null,
    givingMonthlyGoalCents: canSeeGiving ? givingMonthlyGoalCents : null,
    givingMonthlyGoalPercent: canSeeGiving ? givingMonthlyGoalPercent : null,
    activeCampaigns: canSeeGiving ? Number(activeCampaignsRow?.c ?? 0) : null,
    checkedInChildren: canSeeChildren ? Number(checkedInRow?.c ?? 0) : null,
    totalChildren: canSeeChildren ? totalChildren : null,
    childrenMinistryAttendance: canSeeChildren ? {
      averageCheckedIn: averageChildrenCheckedIn,
      attendanceRate: childrenAttendanceRate,
      latestCheckedIn: latestChildrenAttendance,
      totalRegistered: totalChildren,
    } : null,
    attendanceRateLast4: canSeeAttendance ? attendanceRateLast4 : null,
    attendanceTrend: canSeeAttendance ? attendanceTrend : null,
    givingTrend: canSeeGiving ? givingTrend : null,
    regularServiceAttendance: canSeeAttendance ? {
      averagePerSession: regularAveragePerSession,
      averageAttendanceRate: regularAverageAttendanceRate,
      latestSessionCount: latestRegularCount,
      last8Sessions: regularAttendanceTrend.map((session) => ({
        sessionId: session.sessionId,
        sessionName: session.sessionName,
        sessionDate: session.sessionDate,
        attendeeCount: session.present,
        memberCount,
        attendanceRate: memberCount > 0 ? Math.round((session.present / memberCount) * 100) : 0,
        breakdown: session.breakdown,
      })),
    } : null,
    discipleshipAttendance: canSeeAttendance ? {
      totalTaggedDisciples,
      latestCheckedIn,
      latestAttendanceRate,
      averagePerSession: discipleshipAveragePerSession,
      last8Sessions: discipleshipAttendanceTrend.map((session) => ({
        sessionId: session.sessionId,
        sessionName: session.sessionName,
        sessionDate: session.sessionDate,
        checkedInDisciples: session.checkedInDisciples,
        totalTaggedDisciples: session.totalTaggedDisciples,
        attendanceRate: session.attendanceRate,
      })),
    } : null,
    givingByService: canSeeGiving ? {
      last8RegularServices: givingByServiceLast8,
    } : null,
    recentNewMembers: canSeeMembers ? recentNewMembers.map((m) => ({
      id: m.id,
      firstName: m.firstName,
      lastName: m.lastName,
      memberStatus: m.memberStatus,
      ministryDepartment: m.ministryDepartment,
      createdAt: m.createdAt.toISOString(),
    })) : null,
    lastUpdated: now.toISOString(),
  });
});

export default router;
