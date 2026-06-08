import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { attendanceRecordsTable, attendanceSessionsTable, db, eventsTable, usersTable, type Event } from "@workspace/db";
import { ADMIN_PERMISSIONS } from "../lib/admin-permissions";
import { requireAdminPermission, requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
const requireEventManagement = requireAdminPermission(ADMIN_PERMISSIONS.EVENT_MANAGEMENT);

const EVENT_TYPES = new Set(["service", "discipleship", "bible_study", "prayer", "baptism", "fasting_season", "special_event", "announcement"]);
const EVENT_MODES = new Set(["in_person", "online", "hybrid"]);
const RECURRENCE_PATTERNS = new Set(["weekly", "one_time", "custom"]);
const EVENT_STATUSES = new Set(["draft", "published", "cancelled"]);
const EVENT_VISIBILITIES = new Set(["public", "admin_only"]);

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

async function getRequesterChurchId(userId: number) {
  const [user] = await db
    .select({ churchId: usersTable.churchId })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  return user?.churchId ?? null;
}

function serializeEvent(event: Event) {
  return {
    id: event.id,
    title: event.title,
    eventType: event.eventType,
    description: event.description,
    startDatetime: event.startDatetime.toISOString(),
    endDatetime: event.endDatetime.toISOString(),
    location: event.location,
    eventMode: event.eventMode,
    zoomLink: event.zoomLink,
    youtubeLink: event.youtubeLink,
    posterUrl: event.posterUrl,
    isRecurring: event.isRecurring,
    recurrencePattern: event.recurrencePattern,
    recurrenceDay: event.recurrenceDay,
    recurrenceTime: event.recurrenceTime,
    visibility: event.visibility,
    status: event.status,
    createdByUserId: event.createdByUserId,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

function expandOccurrences(event: Event, rangeStart: Date, rangeEnd: Date) {
  const duration = event.endDatetime.getTime() - event.startDatetime.getTime();
  if (!event.isRecurring || event.recurrencePattern !== "weekly") {
    if (event.startDatetime > rangeEnd || event.endDatetime < rangeStart) return [];
    return [{ ...serializeEvent(event), eventId: event.id, occurrenceStartDatetime: event.startDatetime.toISOString(), occurrenceEndDatetime: event.endDatetime.toISOString() }];
  }

  const occurrences = [];
  const start = new Date(event.startDatetime);
  while (start < rangeStart) start.setDate(start.getDate() + 7);
  while (start <= rangeEnd) {
    const end = new Date(start.getTime() + duration);
    occurrences.push({
      ...serializeEvent(event),
      eventId: event.id,
      occurrenceStartDatetime: start.toISOString(),
      occurrenceEndDatetime: end.toISOString(),
    });
    start.setDate(start.getDate() + 7);
  }
  return occurrences;
}

function eventPayload(body: unknown) {
  const record = typeof body === "object" && body ? body as Record<string, unknown> : {};
  const startDatetime = dateFromValue(record.startDatetime);
  const endDatetime = dateFromValue(record.endDatetime);
  const isRecurring = record.isRecurring === true;
  const recurrencePattern = enumValue(record.recurrencePattern, RECURRENCE_PATTERNS, isRecurring ? "weekly" : "one_time");
  const recurrenceDay = startDatetime ? startDatetime.getDay() : null;
  const recurrenceTime = startDatetime
    ? `${String(startDatetime.getHours()).padStart(2, "0")}:${String(startDatetime.getMinutes()).padStart(2, "0")}`
    : null;

  return {
    title: requiredText(record.title),
    eventType: enumValue(record.eventType, EVENT_TYPES, "service"),
    description: textOrNull(record.description),
    startDatetime,
    endDatetime,
    location: textOrNull(record.location),
    eventMode: enumValue(record.eventMode, EVENT_MODES, "in_person"),
    zoomLink: textOrNull(record.zoomLink),
    youtubeLink: textOrNull(record.youtubeLink),
    posterUrl: textOrNull(record.posterUrl),
    isRecurring,
    recurrencePattern,
    recurrenceDay: isRecurring ? recurrenceDay : null,
    recurrenceTime: isRecurring ? recurrenceTime : null,
    visibility: enumValue(record.visibility, EVENT_VISIBILITIES, "public"),
    status: enumValue(record.status, EVENT_STATUSES, "draft"),
  };
}

async function listEvents(churchId: number, includeDrafts: boolean, query: Record<string, unknown>) {
  const search = typeof query.search === "string" ? query.search.trim() : "";
  const eventType = typeof query.eventType === "string" ? query.eventType : "";
  const rangeStart = dateFromValue(query.start) ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const rangeEnd = dateFromValue(query.end) ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  const limit = typeof query.limit === "string" ? Number(query.limit) : 250;

  const filters = [
    eq(eventsTable.churchId, churchId),
    ...(includeDrafts ? [] : [
      or(eq(eventsTable.status, "published"), eq(eventsTable.status, "cancelled")),
      eq(eventsTable.visibility, "public"),
    ]),
    ...(EVENT_TYPES.has(eventType) ? [eq(eventsTable.eventType, eventType as typeof eventsTable.$inferSelect.eventType)] : []),
    ...(search ? [or(ilike(eventsTable.title, `%${search}%`), ilike(eventsTable.description, `%${search}%`))] : []),
  ];

  const events = await db
    .select()
    .from(eventsTable)
    .where(and(...filters))
    .orderBy(eventsTable.startDatetime);

  return events
    .flatMap((event) => expandOccurrences(event, rangeStart, rangeEnd))
    .sort((a, b) => new Date(a.occurrenceStartDatetime).getTime() - new Date(b.occurrenceStartDatetime).getTime())
    .slice(0, Number.isFinite(limit) ? Math.max(1, Math.min(limit, 500)) : 250);
}

router.get("/events", requireAuth, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "User church not found." });
    return;
  }

  res.json({ events: await listEvents(churchId, false, req.query) });
});

router.get("/events/:id", requireAuth, async (req, res): Promise<void> => {
  const eventId = Number(req.params.id);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(eventId) || !churchId) {
    res.status(400).json({ error: "Invalid event." });
    return;
  }

  const [event] = await db
    .select()
    .from(eventsTable)
    .where(and(
      eq(eventsTable.id, eventId),
      eq(eventsTable.churchId, churchId),
      eq(eventsTable.visibility, "public"),
      or(eq(eventsTable.status, "published"), eq(eventsTable.status, "cancelled")),
    ));

  if (!event) {
    res.status(404).json({ error: "Event not found." });
    return;
  }

  res.json({ event: serializeEvent(event) });
});

router.get("/admin/events", requireEventManagement, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "User church not found." });
    return;
  }

  res.json({ events: await listEvents(churchId, true, req.query) });
});

router.get("/admin/events/:id", requireEventManagement, async (req, res): Promise<void> => {
  const eventId = Number(req.params.id);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(eventId) || !churchId) {
    res.status(400).json({ error: "Invalid event." });
    return;
  }

  const [event] = await db
    .select()
    .from(eventsTable)
    .where(and(eq(eventsTable.id, eventId), eq(eventsTable.churchId, churchId)));

  if (!event) {
    res.status(404).json({ error: "Event not found." });
    return;
  }

  const linkedSessions = await db
    .select({ sessionId: attendanceSessionsTable.id })
    .from(attendanceSessionsTable)
    .where(and(
      eq(attendanceSessionsTable.serviceEventId, eventId),
      eq(attendanceSessionsTable.churchId, churchId),
    ));

  const linkedSessionCount = linkedSessions.length;
  let linkedAttendanceCount = 0;

  if (linkedSessionCount > 0) {
    const sessionIds = linkedSessions.map((r) => r.sessionId);
    const [countRow] = await db
      .select({ total: count() })
      .from(attendanceRecordsTable)
      .where(and(
        inArray(attendanceRecordsTable.sessionId, sessionIds),
        eq(attendanceRecordsTable.attendanceStatus, "present"),
      ));
    linkedAttendanceCount = Number(countRow?.total ?? 0);
  }

  res.json({ event: { ...serializeEvent(event), linkedSessionCount, linkedAttendanceCount } });
});

router.post("/admin/events", requireEventManagement, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "User church not found." });
    return;
  }

  const payload = eventPayload(req.body);
  if (!payload.title || !payload.startDatetime || !payload.endDatetime || payload.endDatetime <= payload.startDatetime) {
    res.status(400).json({ error: "Title, start date/time, and a later end date/time are required." });
    return;
  }
  const values = { ...payload, startDatetime: payload.startDatetime, endDatetime: payload.endDatetime };

  const [event] = await db
    .insert(eventsTable)
    .values({ churchId, createdByUserId: req.localUserId, ...values })
    .returning();

  res.status(201).json({ event: serializeEvent(event) });
});

router.patch("/admin/events/:id", requireEventManagement, async (req, res): Promise<void> => {
  const eventId = Number(req.params.id);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(eventId) || !churchId) {
    res.status(400).json({ error: "Invalid event." });
    return;
  }

  const payload = eventPayload(req.body);
  if (!payload.title || !payload.startDatetime || !payload.endDatetime || payload.endDatetime <= payload.startDatetime) {
    res.status(400).json({ error: "Title, start date/time, and a later end date/time are required." });
    return;
  }
  const values = { ...payload, startDatetime: payload.startDatetime, endDatetime: payload.endDatetime };

  const [event] = await db
    .update(eventsTable)
    .set(values)
    .where(and(eq(eventsTable.id, eventId), eq(eventsTable.churchId, churchId)))
    .returning();

  if (!event) {
    res.status(404).json({ error: "Event not found." });
    return;
  }

  res.json({ event: serializeEvent(event) });
});

router.delete("/admin/events/:id", requireEventManagement, async (req, res): Promise<void> => {
  const eventId = Number(req.params.id);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(eventId) || !churchId) {
    res.status(400).json({ error: "Invalid event." });
    return;
  }

  const [event] = await db
    .delete(eventsTable)
    .where(and(eq(eventsTable.id, eventId), eq(eventsTable.churchId, churchId)))
    .returning({ id: eventsTable.id });

  if (!event) {
    res.status(404).json({ error: "Event not found." });
    return;
  }

  res.json({ ok: true });
});

export default router;
