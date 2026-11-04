import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import express, { Router, type IRouter } from "express";
import {
  CHILD_DOCUMENT_CATEGORIES,
  childDocumentsTable,
  childIncidentsTable,
  childPermissionSlipsTable,
  childrenClassroomsTable,
  childrenTable,
  db,
  usersTable,
  type ChildDocumentCategory,
} from "@workspace/db";
import { ADMIN_PERMISSIONS } from "../lib/admin-permissions";
import { requireAdminPermission } from "../middlewares/auth";

const router: IRouter = Router();
const requireCheckInAccess = requireAdminPermission(ADMIN_PERMISSIONS.ATTENDANCE_CHECKIN);
const requireLeaderAccess = requireAdminPermission(ADMIN_PERMISSIONS.CHILDREN_MINISTRY_MANAGE);

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = /^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/i;

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function ageOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 18 ? number : null;
}

function isDocumentCategory(value: unknown): value is ChildDocumentCategory {
  return typeof value === "string" && (CHILD_DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

async function getRequesterChurchId(userId: number) {
  const [user] = await db
    .select({ churchId: usersTable.churchId })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user?.churchId ?? null;
}

async function findChild(childId: number, churchId: number) {
  const [child] = await db
    .select()
    .from(childrenTable)
    .where(and(eq(childrenTable.id, childId), eq(childrenTable.churchId, churchId)));
  return child ?? null;
}

function fullName(firstName: string | null, lastName: string | null) {
  return firstName && lastName ? `${firstName} ${lastName}` : null;
}

// ── Classrooms ─────────────────────────────────────────────────────────────

function serializeClassroom(classroom: typeof childrenClassroomsTable.$inferSelect) {
  return {
    id: classroom.id,
    name: classroom.name,
    minAgeYears: classroom.minAgeYears,
    maxAgeYears: classroom.maxAgeYears,
    isSpecialNeeds: classroom.isSpecialNeeds,
    sortOrder: classroom.sortOrder,
  };
}

function classroomInput(body: unknown) {
  const record = typeof body === "object" && body ? body as Record<string, unknown> : {};
  return {
    name: textOrNull(record.name),
    minAgeYears: ageOrNull(record.minAgeYears),
    maxAgeYears: ageOrNull(record.maxAgeYears),
    isSpecialNeeds: record.isSpecialNeeds === true || record.isSpecialNeeds === "true",
    sortOrder: Number.isInteger(Number(record.sortOrder)) ? Number(record.sortOrder) : 0,
  };
}

router.get("/admin/children/classrooms", requireCheckInAccess, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "User church not found." });
    return;
  }

  const classrooms = await db
    .select()
    .from(childrenClassroomsTable)
    .where(eq(childrenClassroomsTable.churchId, churchId))
    .orderBy(asc(childrenClassroomsTable.sortOrder), asc(childrenClassroomsTable.minAgeYears), asc(childrenClassroomsTable.name));

  res.json({ classrooms: classrooms.map(serializeClassroom) });
});

router.post("/admin/children/classrooms", requireLeaderAccess, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "User church not found." });
    return;
  }

  const input = classroomInput(req.body);
  if (!input.name) {
    res.status(400).json({ error: "Classroom name is required." });
    return;
  }
  if (input.minAgeYears !== null && input.maxAgeYears !== null && input.minAgeYears > input.maxAgeYears) {
    res.status(400).json({ error: "Minimum age cannot be greater than maximum age." });
    return;
  }

  const [existing] = await db
    .select({ id: childrenClassroomsTable.id })
    .from(childrenClassroomsTable)
    .where(and(eq(childrenClassroomsTable.churchId, churchId), eq(childrenClassroomsTable.name, input.name)));
  if (existing) {
    res.status(409).json({ error: "A classroom with that name already exists." });
    return;
  }

  const [classroom] = await db
    .insert(childrenClassroomsTable)
    .values({ churchId, ...input, name: input.name })
    .returning();

  res.status(201).json({ classroom: serializeClassroom(classroom) });
});

router.patch("/admin/children/classrooms/:classroomId", requireLeaderAccess, async (req, res): Promise<void> => {
  const classroomId = Number(req.params.classroomId);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(classroomId) || !churchId) {
    res.status(400).json({ error: "Invalid classroom." });
    return;
  }

  const input = classroomInput(req.body);
  if (!input.name) {
    res.status(400).json({ error: "Classroom name is required." });
    return;
  }
  if (input.minAgeYears !== null && input.maxAgeYears !== null && input.minAgeYears > input.maxAgeYears) {
    res.status(400).json({ error: "Minimum age cannot be greater than maximum age." });
    return;
  }

  const [current] = await db
    .select()
    .from(childrenClassroomsTable)
    .where(and(eq(childrenClassroomsTable.id, classroomId), eq(childrenClassroomsTable.churchId, churchId)));
  if (!current) {
    res.status(404).json({ error: "Classroom not found." });
    return;
  }

  const [classroom] = await db
    .update(childrenClassroomsTable)
    .set({ ...input, name: input.name })
    .where(eq(childrenClassroomsTable.id, classroomId))
    .returning();

  // Keep children assigned to a renamed classroom in that classroom.
  if (current.name !== classroom.name) {
    await db
      .update(childrenTable)
      .set({ classroom: classroom.name })
      .where(and(eq(childrenTable.churchId, churchId), eq(childrenTable.classroom, current.name)));
  }

  res.json({ classroom: serializeClassroom(classroom) });
});

router.delete("/admin/children/classrooms/:classroomId", requireLeaderAccess, async (req, res): Promise<void> => {
  const classroomId = Number(req.params.classroomId);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(classroomId) || !churchId) {
    res.status(400).json({ error: "Invalid classroom." });
    return;
  }

  const [deleted] = await db
    .delete(childrenClassroomsTable)
    .where(and(eq(childrenClassroomsTable.id, classroomId), eq(childrenClassroomsTable.churchId, churchId)))
    .returning({ id: childrenClassroomsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Classroom not found." });
    return;
  }

  res.json({ ok: true });
});

// ── Incidents ──────────────────────────────────────────────────────────────

const resolvedByUser = alias(usersTable, "incident_resolved_by");

async function listIncidents(churchId: number, filters: { childId?: number; status?: "open" | "resolved" }) {
  const conditions = [eq(childIncidentsTable.churchId, churchId)];
  if (filters.childId) conditions.push(eq(childIncidentsTable.childId, filters.childId));
  if (filters.status) conditions.push(eq(childIncidentsTable.status, filters.status));

  const rows = await db
    .select({
      incident: childIncidentsTable,
      childFirstName: childrenTable.firstName,
      childLastName: childrenTable.lastName,
      reportedByFirstName: usersTable.firstName,
      reportedByLastName: usersTable.lastName,
      resolvedByFirstName: resolvedByUser.firstName,
      resolvedByLastName: resolvedByUser.lastName,
    })
    .from(childIncidentsTable)
    .innerJoin(childrenTable, eq(childIncidentsTable.childId, childrenTable.id))
    .innerJoin(usersTable, eq(childIncidentsTable.reportedByUserId, usersTable.id))
    .leftJoin(resolvedByUser, eq(childIncidentsTable.resolvedByUserId, resolvedByUser.id))
    .where(and(...conditions))
    .orderBy(desc(childIncidentsTable.occurredAt));

  return rows.map((row) => ({
    id: row.incident.id,
    childId: row.incident.childId,
    childName: `${row.childFirstName} ${row.childLastName}`,
    occurredAt: row.incident.occurredAt.toISOString(),
    classroom: row.incident.classroom,
    description: row.incident.description,
    actionTaken: row.incident.actionTaken,
    status: row.incident.status,
    reportedByName: `${row.reportedByFirstName} ${row.reportedByLastName}`,
    resolutionNotes: row.incident.resolutionNotes,
    resolvedByName: fullName(row.resolvedByFirstName, row.resolvedByLastName),
    resolvedAt: row.incident.resolvedAt ? row.incident.resolvedAt.toISOString() : null,
  }));
}

router.get("/admin/children/incidents", requireLeaderAccess, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "User church not found." });
    return;
  }

  const status = req.query.status === "open" || req.query.status === "resolved" ? req.query.status : undefined;
  const childId = Number(req.query.childId);
  res.json({
    incidents: await listIncidents(churchId, {
      status,
      childId: Number.isInteger(childId) && childId > 0 ? childId : undefined,
    }),
  });
});

// Anyone running check-in can report an incident; only leaders can read or close it.
router.post("/admin/children/:childId/incidents", requireCheckInAccess, async (req, res): Promise<void> => {
  const childId = Number(req.params.childId);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(childId) || !churchId) {
    res.status(400).json({ error: "Invalid child." });
    return;
  }

  const child = await findChild(childId, churchId);
  if (!child) {
    res.status(404).json({ error: "Child not found." });
    return;
  }

  const description = textOrNull(req.body?.description);
  if (!description) {
    res.status(400).json({ error: "Describe what happened." });
    return;
  }

  const occurredAtInput = textOrNull(req.body?.occurredAt);
  const occurredAt = occurredAtInput ? new Date(occurredAtInput) : new Date();
  if (Number.isNaN(occurredAt.getTime()) || occurredAt.getTime() > Date.now() + 5 * 60 * 1000) {
    res.status(400).json({ error: "Enter a valid time that is not in the future." });
    return;
  }

  const [incident] = await db
    .insert(childIncidentsTable)
    .values({
      churchId,
      childId,
      occurredAt,
      classroom: textOrNull(req.body?.classroom) ?? child.classroom,
      description,
      actionTaken: textOrNull(req.body?.actionTaken),
      reportedByUserId: req.localUserId,
      status: "open",
    })
    .returning({ id: childIncidentsTable.id });

  res.status(201).json({ incidentId: incident.id });
});

router.post("/admin/children/incidents/:incidentId/resolve", requireLeaderAccess, async (req, res): Promise<void> => {
  const incidentId = Number(req.params.incidentId);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(incidentId) || !churchId) {
    res.status(400).json({ error: "Invalid incident." });
    return;
  }

  const resolutionNotes = textOrNull(req.body?.resolutionNotes);
  if (!resolutionNotes) {
    res.status(400).json({ error: "Record how the incident was handled, including the conversation with the parents." });
    return;
  }

  const [incident] = await db
    .update(childIncidentsTable)
    .set({
      status: "resolved",
      resolutionNotes,
      resolvedByUserId: req.localUserId,
      resolvedAt: new Date(),
    })
    .where(
      and(
        eq(childIncidentsTable.id, incidentId),
        eq(childIncidentsTable.churchId, churchId),
        eq(childIncidentsTable.status, "open"),
      ),
    )
    .returning({ id: childIncidentsTable.id });

  if (!incident) {
    res.status(404).json({ error: "Open incident not found." });
    return;
  }

  res.json({ ok: true });
});

// ── Documents ──────────────────────────────────────────────────────────────

router.get("/admin/children/:childId/documents", requireLeaderAccess, async (req, res): Promise<void> => {
  const childId = Number(req.params.childId);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(childId) || !churchId) {
    res.status(400).json({ error: "Invalid child." });
    return;
  }

  const documents = await db
    .select({
      id: childDocumentsTable.id,
      category: childDocumentsTable.category,
      title: childDocumentsTable.title,
      permissionSlipId: childDocumentsTable.permissionSlipId,
      fileName: childDocumentsTable.fileName,
      mimeType: childDocumentsTable.mimeType,
      sizeBytes: childDocumentsTable.sizeBytes,
      createdAt: childDocumentsTable.createdAt,
      uploadedByFirstName: usersTable.firstName,
      uploadedByLastName: usersTable.lastName,
    })
    .from(childDocumentsTable)
    .innerJoin(usersTable, eq(childDocumentsTable.uploadedByUserId, usersTable.id))
    .where(and(eq(childDocumentsTable.childId, childId), eq(childDocumentsTable.churchId, churchId)))
    .orderBy(desc(childDocumentsTable.createdAt));

  res.json({
    documents: documents.map(({ uploadedByFirstName, uploadedByLastName, createdAt, ...document }) => ({
      ...document,
      createdAt: createdAt.toISOString(),
      uploadedByName: `${uploadedByFirstName} ${uploadedByLastName}`,
    })),
  });
});

// The file is sent as the raw request body; details travel in the query string.
router.post(
  "/admin/children/:childId/documents",
  requireLeaderAccess,
  express.raw({ type: () => true, limit: MAX_DOCUMENT_BYTES }),
  async (req, res): Promise<void> => {
    const childId = Number(req.params.childId);
    const churchId = await getRequesterChurchId(req.localUserId);
    if (!Number.isInteger(childId) || !churchId) {
      res.status(400).json({ error: "Invalid child." });
      return;
    }

    const child = await findChild(childId, churchId);
    if (!child) {
      res.status(404).json({ error: "Child not found." });
      return;
    }

    const mimeType = (req.headers["content-type"] ?? "").split(";")[0].trim();
    if (!ALLOWED_DOCUMENT_TYPES.test(mimeType)) {
      res.status(415).json({ error: "Upload a PDF or a photo (JPEG, PNG, WebP, or HEIC)." });
      return;
    }

    const fileData = Buffer.isBuffer(req.body) ? req.body : null;
    if (!fileData || fileData.length === 0) {
      res.status(400).json({ error: "The file is empty." });
      return;
    }

    const category = req.query.category;
    if (!isDocumentCategory(category)) {
      res.status(400).json({ error: "Choose a document category." });
      return;
    }

    let permissionSlipId: number | null = null;
    if (category === "event_permission") {
      permissionSlipId = Number(req.query.permissionSlipId);
      const [slip] = Number.isInteger(permissionSlipId)
        ? await db
            .select({ id: childPermissionSlipsTable.id })
            .from(childPermissionSlipsTable)
            .where(and(eq(childPermissionSlipsTable.id, permissionSlipId), eq(childPermissionSlipsTable.churchId, churchId)))
        : [];
      if (!slip) {
        res.status(400).json({ error: "Choose which permission slip this form is for." });
        return;
      }
    }

    const fileName = textOrNull(req.query.fileName) ?? "document";
    const title = textOrNull(req.query.title) ?? fileName;

    const [document] = await db
      .insert(childDocumentsTable)
      .values({
        churchId,
        childId,
        category,
        title,
        permissionSlipId,
        fileName,
        mimeType,
        sizeBytes: fileData.length,
        fileData,
        uploadedByUserId: req.localUserId,
      })
      .returning({ id: childDocumentsTable.id });

    res.status(201).json({ documentId: document.id });
  },
);

router.get("/admin/children/documents/:documentId/file", requireLeaderAccess, async (req, res): Promise<void> => {
  const documentId = Number(req.params.documentId);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(documentId) || !churchId) {
    res.status(400).json({ error: "Invalid document." });
    return;
  }

  const [document] = await db
    .select({
      fileName: childDocumentsTable.fileName,
      mimeType: childDocumentsTable.mimeType,
      fileData: childDocumentsTable.fileData,
    })
    .from(childDocumentsTable)
    .where(and(eq(childDocumentsTable.id, documentId), eq(childDocumentsTable.churchId, churchId)));

  if (!document) {
    res.status(404).json({ error: "Document not found." });
    return;
  }

  res.setHeader("Content-Type", document.mimeType);
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(document.fileName)}`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(document.fileData);
});

router.delete("/admin/children/documents/:documentId", requireLeaderAccess, async (req, res): Promise<void> => {
  const documentId = Number(req.params.documentId);
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!Number.isInteger(documentId) || !churchId) {
    res.status(400).json({ error: "Invalid document." });
    return;
  }

  const [deleted] = await db
    .delete(childDocumentsTable)
    .where(and(eq(childDocumentsTable.id, documentId), eq(childDocumentsTable.churchId, churchId)))
    .returning({ id: childDocumentsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Document not found." });
    return;
  }

  res.json({ ok: true });
});

// ── Permission slips ───────────────────────────────────────────────────────

router.get("/admin/children/permission-slips", requireLeaderAccess, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "User church not found." });
    return;
  }

  const slips = await db
    .select()
    .from(childPermissionSlipsTable)
    .where(eq(childPermissionSlipsTable.churchId, churchId))
    .orderBy(desc(childPermissionSlipsTable.createdAt));

  const slipIds = slips.map((slip) => slip.id);
  const returned = slipIds.length > 0
    ? await db
        .selectDistinct({ slipId: childDocumentsTable.permissionSlipId, childId: childDocumentsTable.childId })
        .from(childDocumentsTable)
        .where(and(inArray(childDocumentsTable.permissionSlipId, slipIds), isNotNull(childDocumentsTable.permissionSlipId)))
    : [];

  const childrenBySlip = new Map<number, number[]>();
  for (const row of returned) {
    if (row.slipId === null) continue;
    childrenBySlip.set(row.slipId, [...(childrenBySlip.get(row.slipId) ?? []), row.childId]);
  }

  res.json({
    permissionSlips: slips.map((slip) => ({
      id: slip.id,
      title: slip.title,
      eventDate: slip.eventDate,
      notes: slip.notes,
      createdAt: slip.createdAt.toISOString(),
      returnedChildIds: childrenBySlip.get(slip.id) ?? [],
    })),
  });
});

router.post("/admin/children/permission-slips", requireLeaderAccess, async (req, res): Promise<void> => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "User church not found." });
    return;
  }

  const title = textOrNull(req.body?.title);
  if (!title) {
    res.status(400).json({ error: "Give the permission slip a title." });
    return;
  }

  const eventDate = textOrNull(req.body?.eventDate);
  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    res.status(400).json({ error: "Enter a valid event date." });
    return;
  }

  const [slip] = await db
    .insert(childPermissionSlipsTable)
    .values({
      churchId,
      title,
      eventDate,
      notes: textOrNull(req.body?.notes),
      createdByUserId: req.localUserId,
    })
    .returning({ id: childPermissionSlipsTable.id });

  res.status(201).json({ permissionSlipId: slip.id });
});

export default router;
