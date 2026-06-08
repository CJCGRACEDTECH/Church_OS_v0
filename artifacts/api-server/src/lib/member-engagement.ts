import { and, eq, gte, inArray, lte } from "drizzle-orm";
import {
  attendanceRecordsTable,
  attendanceSessionsTable,
  db,
  usersTable,
} from "@workspace/db";

const ACTIVE_MEMBER_ATTENDANCE_THRESHOLD = 0.5;

function monthRange(targetDate: Date) {
  const start = new Date(targetDate);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setMilliseconds(-1);
  return { start, end };
}

export async function getActiveMemberIdsForMonth(churchId: number, targetDate: Date) {
  const { start, end } = monthRange(targetDate);
  const memberRows = await db
    .select({
      id: usersTable.id,
      memberStatus: usersTable.memberStatus,
      servingStatus: usersTable.servingStatus,
    })
    .from(usersTable)
    .where(and(
      eq(usersTable.churchId, churchId),
      eq(usersTable.role, "member"),
      inArray(usersTable.memberStatus, ["member", "active_member"]),
    ));

  const monthlyServiceSessions = await db
    .select({ id: attendanceSessionsTable.id })
    .from(attendanceSessionsTable)
    .where(and(
      eq(attendanceSessionsTable.churchId, churchId),
      eq(attendanceSessionsTable.attendanceType, "regular_service"),
      gte(attendanceSessionsTable.sessionDate, start),
      lte(attendanceSessionsTable.sessionDate, end),
    ));

  const memberIds = memberRows.map((member) => member.id);
  const monthlyServiceSessionIds = monthlyServiceSessions.map((session) => session.id);
  const presentRows = memberIds.length > 0 && monthlyServiceSessionIds.length > 0
    ? await db
        .select({ memberId: attendanceRecordsTable.memberId })
        .from(attendanceRecordsTable)
        .where(and(
          inArray(attendanceRecordsTable.sessionId, monthlyServiceSessionIds),
          inArray(attendanceRecordsTable.memberId, memberIds),
          eq(attendanceRecordsTable.attendanceStatus, "present"),
        ))
    : [];

  const monthlyAttendanceCountByMember = new Map<number, number>();
  for (const row of presentRows) {
    monthlyAttendanceCountByMember.set(row.memberId, (monthlyAttendanceCountByMember.get(row.memberId) ?? 0) + 1);
  }

  return new Set(memberRows.filter((member) => {
    const attendanceRate = monthlyServiceSessionIds.length > 0
      ? (monthlyAttendanceCountByMember.get(member.id) ?? 0) / monthlyServiceSessionIds.length
      : 0;
    return member.servingStatus === "serving" || attendanceRate > ACTIVE_MEMBER_ATTENDANCE_THRESHOLD;
  }).map((member) => member.id));
}
