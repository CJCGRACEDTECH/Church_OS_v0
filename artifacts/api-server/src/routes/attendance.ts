import { randomBytes } from "node:crypto";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  attendanceRecordsTable,
  attendanceSessionsTable,
  db,
  eventsTable,
  usersTable,
  type AttendanceRecord,
  type AttendanceSession,
} from "@workspace/db";
import { ADMIN_PERMISSIONS } from "../lib/admin-permissions";
import { requireAdminPermission, requireAuth } from "../middlewares/auth";
import { formatFollowUpMessage, sendSms, SMS_ENABLED } from "../lib/sms";

const router: IRouter = Router();
const requireAttendanceManagement = requireAdminPermission(ADMIN_PERMISSIONS.ATTENDANCE_MANAGEMENT);

const ATTENDANCE_TYPES = new Set(["regular_service", "discipleship"]);
const SESSION_STATUSES = new Set(["upcoming", "active", "closed"]);
const ATTENDANCE_STATUSES = new Set(["present", "absent", "excused", "late"]);
const COMPLETION_STATUSES = new Set(["attended", "missed", "make_up_needed"]);

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function enumValue<T extends string>(value: unknown, allowed: Set<string>, fallback: T): T {
  return typeof value === "string" && allowed.has(value) ? (value as T) : fallback;
}

function dateFromValue(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function qrToken() {
  return randomBytes(24).toString("base64url");
}

async function getRequesterChurchId(userId: number) {
  const [user] = await db
    .select({ churchId: usersTable.churchId })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user?.churchId ?? null;
}

function serializeSession(session: AttendanceSession) {
  return {
    id: session.id,
    attendanceType: session.attendanceType,
    serviceEventId: session.serviceEventId,
    sessionName: session.sessionName,
    sessionDate: session.sessionDate.toISOString(),
    startTime: session.startTime,
    location: session.location,
    discipleshipGroup: session.discipleshipGroup,
    teacherLeader: session.teacherLeader,
    lessonTopic: session.lessonTopic,
    qrToken: session.qrToken,
    qrEnabled: session.qrEnabled,
    qrExpiration: session.qrExpiration.toISOString(),
    sessionStatus: session.sessionStatus,
    createdByUserId: session.createdByUserId,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

function serializeRecord(record: AttendanceRecord, member?: { firstName: string; lastName: string; email: string | null }) {
  return {
    id: record.id,
    sessionId: record.sessionId,
    memberId: record.memberId,
    memberName: member ? `${member.firstName} ${member.lastName}` : null,
    memberEmail: member?.email ?? null,
    attendanceStatus: record.attendanceStatus,
    checkinSource: record.checkinSource,
    checkinTime: record.checkinTime.toISOString(),
    checkedInByUserId: record.checkedInByUserId,
    notes: record.notes,
    completionStatus: record.completionStatus,
    followUpNeeded: record.followUpNeeded,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function sessionPayload(body: unknown) {
  const record = typeof body === "object" && body ? body as Record<string, unknown> : {};
  const sessionDate = dateFromValue(record.sessionDate);
  const qrExpiration = dateFromValue(record.qrExpiration)
    ?? (sessionDate ? new Date(sessionDate.getTime() + 3 * 60 * 60 * 1000) : null);
  return {
    attendanceType: enumValue(record.attendanceType, ATTENDANCE_TYPES, "regular_service"),
    serviceEventId: typeof record.serviceEventId === "number" ? record.serviceEventId : null,
    sessionName: requiredText(record.sessionName),
    sessionDate,
    startTime: textOrNull(record.startTime),
    location: textOrNull(record.location),
    discipleshipGroup: textOrNull(record.discipleshipGroup),
    teacherLeader: textOrNull(record.teacherLeader),
    lessonTopic: textOrNull(record.lessonTopic),
    qrEnabled: record.qrEnabled !== false,
    qrExpiration,
    sessionStatus: enumValue(record.sessionStatus, SESSION_STATUSES, "upcoming"),
  };
}

function recordPayload(body: unknown) {
  const record = typeof body === "object" && body ? body as Record<string, unknown> : {};
  return {
    memberId: typeof record.memberId === "number" ? record.memberId : Number(record.memberId),
    attendanceStatus: enumValue(record.attendanceStatus, ATTENDANCE_STATUSES, "present"),
    notes: textOrNull(record.notes),
    completionStatus: enumValue(record.completionStatus, COMPLETION_STATUSES, "attended"),
    followUpNeeded: record.followUpNeeded === true,
  };
}

router.get("/admin/attendance/summary", requireAttendanceManagement, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "User church not found." }); return; }

  const sessions = await db.select().from(attendanceSessionsTable).where(eq(attendanceSessionsTable.churchId, churchId)).orderBy(desc(attendanceSessionsTable.sessionDate));
  const sessionIds = sessions.map((session) => session.id);
  const records = sessionIds.length
    ? await db.select().from(attendanceRecordsTable).where(or(...sessionIds.map((id) => eq(attendanceRecordsTable.sessionId, id))))
    : [];
  const today = new Date().toDateString();
  const todaySessionIds = new Set(sessions.filter((session) => session.sessionDate.toDateString() === today).map((session) => session.id));
  const discipleshipSessionIds = new Set(sessions.filter((session) => session.attendanceType === "discipleship").map((session) => session.id));

  res.json({
    totalToday: records.filter((record) => todaySessionIds.has(record.sessionId) && record.attendanceStatus === "present").length,
    activeSessions: sessions.filter((session) => session.sessionStatus === "active").length,
    weeklyAttendance: records.filter((record) => record.attendanceStatus === "present").length,
    discipleshipAttendance: records.filter((record) => discipleshipSessionIds.has(record.sessionId) && record.attendanceStatus === "present").length,
    membersPresent: records.filter((record) => record.attendanceStatus === "present").length,
    visitorsCount: 0,
  });
});

router.get("/admin/attendance/sessions", requireAttendanceManagement, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "User church not found." }); return; }
  const type = typeof req.query.type === "string" ? req.query.type : "";
  const status = typeof req.query.status === "string" ? req.query.status : "";
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const filters = [
    eq(attendanceSessionsTable.churchId, churchId),
    ...(ATTENDANCE_TYPES.has(type) ? [eq(attendanceSessionsTable.attendanceType, type as typeof attendanceSessionsTable.$inferSelect.attendanceType)] : []),
    ...(SESSION_STATUSES.has(status) ? [eq(attendanceSessionsTable.sessionStatus, status as typeof attendanceSessionsTable.$inferSelect.sessionStatus)] : []),
    ...(search ? [or(ilike(attendanceSessionsTable.sessionName, `%${search}%`), ilike(attendanceSessionsTable.discipleshipGroup, `%${search}%`))] : []),
  ];
  const sessions = await db.select().from(attendanceSessionsTable).where(and(...filters)).orderBy(desc(attendanceSessionsTable.sessionDate));
  res.json({ sessions: sessions.map(serializeSession) });
});

router.post("/admin/attendance/sessions", requireAttendanceManagement, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "User church not found." }); return; }
  const payload = sessionPayload(req.body);
  if (!payload.sessionName || !payload.sessionDate || !payload.qrExpiration) {
    res.status(400).json({ error: "Session name, date, and QR expiration are required." });
    return;
  }
  const values = { ...payload, sessionDate: payload.sessionDate, qrExpiration: payload.qrExpiration };
  const [session] = await db.insert(attendanceSessionsTable).values({
    churchId,
    ...values,
    createdByUserId: req.localUserId,
    qrToken: qrToken(),
  }).returning();
  res.status(201).json({ session: serializeSession(session) });
});

router.get("/admin/attendance/sessions/:id", requireAttendanceManagement, async (req, res): Promise<void> => {
  const sessionId = Number(req.params.id);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(sessionId) || !churchId) { res.status(400).json({ error: "Invalid session." }); return; }
  const [session] = await db.select().from(attendanceSessionsTable).where(and(eq(attendanceSessionsTable.id, sessionId), eq(attendanceSessionsTable.churchId, churchId)));
  if (!session) { res.status(404).json({ error: "Session not found." }); return; }
  const records = await db
    .select({ record: attendanceRecordsTable, firstName: usersTable.firstName, lastName: usersTable.lastName, email: usersTable.email })
    .from(attendanceRecordsTable)
    .innerJoin(usersTable, eq(attendanceRecordsTable.memberId, usersTable.id))
    .where(eq(attendanceRecordsTable.sessionId, session.id))
    .orderBy(desc(attendanceRecordsTable.checkinTime));
  res.json({
    session: serializeSession(session),
    records: records.map((row) => serializeRecord(row.record, { firstName: row.firstName, lastName: row.lastName, email: row.email })),
  });
});

router.patch("/admin/attendance/sessions/:id", requireAttendanceManagement, async (req, res): Promise<void> => {
  const sessionId = Number(req.params.id);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(sessionId) || !churchId) { res.status(400).json({ error: "Invalid session." }); return; }
  const payload = sessionPayload(req.body);
  if (!payload.sessionName || !payload.sessionDate || !payload.qrExpiration) {
    res.status(400).json({ error: "Session name, date, and QR expiration are required." });
    return;
  }
  const values = { ...payload, sessionDate: payload.sessionDate, qrExpiration: payload.qrExpiration };
  const [session] = await db.update(attendanceSessionsTable).set(values).where(and(eq(attendanceSessionsTable.id, sessionId), eq(attendanceSessionsTable.churchId, churchId))).returning();
  if (!session) { res.status(404).json({ error: "Session not found." }); return; }
  res.json({ session: serializeSession(session) });
});

router.post("/admin/attendance/sessions/:id/records", requireAttendanceManagement, async (req, res): Promise<void> => {
  const sessionId = Number(req.params.id);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(sessionId) || !churchId) { res.status(400).json({ error: "Invalid session." }); return; }
  const [session] = await db.select().from(attendanceSessionsTable).where(and(eq(attendanceSessionsTable.id, sessionId), eq(attendanceSessionsTable.churchId, churchId)));
  if (!session) { res.status(404).json({ error: "Session not found." }); return; }
  const payload = recordPayload(req.body);
  if (!Number.isInteger(payload.memberId)) { res.status(400).json({ error: "Member is required." }); return; }
  const [member] = await db.select().from(usersTable).where(and(eq(usersTable.id, payload.memberId), eq(usersTable.churchId, churchId), eq(usersTable.role, "member")));
  if (!member) { res.status(404).json({ error: "Member not found." }); return; }
  const [record] = await db.insert(attendanceRecordsTable).values({
    sessionId,
    memberId: payload.memberId,
    attendanceStatus: payload.attendanceStatus,
    checkinSource: "manual_admin",
    checkedInByUserId: req.localUserId,
    notes: payload.notes,
    completionStatus: session.attendanceType === "discipleship" ? payload.completionStatus : null,
    followUpNeeded: payload.followUpNeeded,
  }).onConflictDoUpdate({
    target: [attendanceRecordsTable.sessionId, attendanceRecordsTable.memberId],
    set: {
      attendanceStatus: payload.attendanceStatus,
      checkinSource: "manual_admin",
      checkedInByUserId: req.localUserId,
      notes: payload.notes,
      completionStatus: session.attendanceType === "discipleship" ? payload.completionStatus : null,
      followUpNeeded: payload.followUpNeeded,
      checkinTime: new Date(),
    },
  }).returning();
  res.json({ record: serializeRecord(record, { firstName: member.firstName, lastName: member.lastName, email: member.email }) });
});

router.get("/admin/attendance/members", requireAttendanceManagement, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "User church not found." }); return; }
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const members = await db.select({
    id: usersTable.id,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    email: usersTable.email,
    phoneNumber: usersTable.phoneNumber,
  }).from(usersTable).where(and(
    eq(usersTable.churchId, churchId),
    eq(usersTable.role, "member"),
    ...(search ? [or(ilike(usersTable.firstName, `%${search}%`), ilike(usersTable.lastName, `%${search}%`), ilike(usersTable.email, `%${search}%`), ilike(usersTable.phoneNumber, `%${search}%`))] : []),
  )).orderBy(usersTable.lastName, usersTable.firstName).limit(25);
  res.json({ members });
});

router.get("/admin/attendance/events", requireAttendanceManagement, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) { res.status(401).json({ error: "User church not found." }); return; }
  const events = await db.select({
    id: eventsTable.id,
    title: eventsTable.title,
    startDatetime: eventsTable.startDatetime,
    location: eventsTable.location,
    eventMode: eventsTable.eventMode,
  }).from(eventsTable).where(and(eq(eventsTable.churchId, churchId), eq(eventsTable.status, "published"))).orderBy(eventsTable.startDatetime).limit(50);
  res.json({ events: events.map((event) => ({ ...event, startDatetime: event.startDatetime.toISOString() })) });
});

router.post("/admin/attendance/sessions/:id/follow-up-sms", requireAttendanceManagement, async (req, res): Promise<void> => {
  if (!SMS_ENABLED) {
    res.json({ sent: 0, failed: 0, notConfigured: true });
    return;
  }
  const sessionId = Number(req.params.id);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(sessionId) || !churchId) { res.status(400).json({ error: "Invalid session." }); return; }
  const [session] = await db.select().from(attendanceSessionsTable).where(and(eq(attendanceSessionsTable.id, sessionId), eq(attendanceSessionsTable.churchId, churchId)));
  if (!session) { res.status(404).json({ error: "Session not found." }); return; }
  const records = await db.select({
    memberId: attendanceRecordsTable.memberId,
    firstName: usersTable.firstName,
    lastName: usersTable.lastName,
    phoneNumber: usersTable.phoneNumber,
  }).from(attendanceRecordsTable)
    .innerJoin(usersTable, eq(attendanceRecordsTable.memberId, usersTable.id))
    .where(and(eq(attendanceRecordsTable.sessionId, sessionId), eq(attendanceRecordsTable.followUpNeeded, true)));
  let sent = 0;
  let failed = 0;
  for (const record of records) {
    if (!record.phoneNumber) { failed++; continue; }
    const msg = formatFollowUpMessage(`${record.firstName} ${record.lastName}`, session.sessionName);
    const result = await sendSms(record.phoneNumber, msg);
    if (result.ok) sent++; else failed++;
  }
  res.json({ sent, failed, notConfigured: false });
});

router.get("/attendance/qr/:token", requireAuth, async (req, res): Promise<void> => {
  const token = String(req.params.token);
  const [session] = await db.select().from(attendanceSessionsTable).where(eq(attendanceSessionsTable.qrToken, token));
  if (!session) { res.status(404).json({ error: "Attendance session not found." }); return; }
  res.json({ session: serializeSession(session), expired: !session.qrEnabled || session.sessionStatus !== "active" || session.qrExpiration < new Date() });
});

router.post("/attendance/qr/:token/check-in", requireAuth, async (req, res): Promise<void> => {
  const token = String(req.params.token);
  const [session] = await db.select().from(attendanceSessionsTable).where(eq(attendanceSessionsTable.qrToken, token));
  if (!session) { res.status(404).json({ error: "Attendance session not found." }); return; }
  if (!session.qrEnabled || session.sessionStatus !== "active" || session.qrExpiration < new Date()) {
    res.status(410).json({ error: "This QR check-in is expired or closed." });
    return;
  }
  const [member] = await db.select().from(usersTable).where(and(eq(usersTable.id, req.localUserId), eq(usersTable.churchId, session.churchId), eq(usersTable.role, "member")));
  if (!member) {
    res.status(403).json({ error: "QR check-in only records the signed-in member." });
    return;
  }
  try {
    const [record] = await db.insert(attendanceRecordsTable).values({
      sessionId: session.id,
      memberId: member.id,
      attendanceStatus: "present",
      checkinSource: "qr_self_checkin",
      checkedInByUserId: member.id,
      completionStatus: session.attendanceType === "discipleship" ? "attended" : null,
    }).returning();
    res.status(201).json({ record: serializeRecord(record, { firstName: member.firstName, lastName: member.lastName, email: member.email }) });
  } catch {
    res.status(409).json({ error: "You are already checked in for this session." });
  }
});

export default router;
