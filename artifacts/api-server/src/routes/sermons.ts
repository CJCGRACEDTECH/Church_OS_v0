import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, sermonsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { requireAdminPermission } from "../middlewares/auth";
import { ADMIN_PERMISSIONS } from "../lib/admin-permissions";

const router: IRouter = Router();
const requireEventManagement = requireAdminPermission(ADMIN_PERMISSIONS.EVENT_MANAGEMENT);

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requiredText(value: unknown): string {
  const s = typeof value === "string" ? value.trim() : "";
  return s;
}

function serializeSermon(sermon: typeof sermonsTable.$inferSelect) {
  return {
    id: sermon.id,
    churchId: sermon.churchId,
    title: sermon.title,
    speakerName: sermon.speakerName,
    seriesName: sermon.seriesName,
    description: sermon.description,
    youtubeVideoId: sermon.youtubeVideoId,
    sermonDate: sermon.sermonDate.toISOString(),
    isPublished: sermon.isPublished,
    createdByUserId: sermon.createdByUserId,
    createdAt: sermon.createdAt.toISOString(),
    updatedAt: sermon.updatedAt.toISOString(),
  };
}

async function getRequesterChurchId(userId: number): Promise<number | null> {
  const [user] = await db
    .select({ churchId: usersTable.churchId })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return user?.churchId ?? null;
}

// GET /api/admin/sermons
router.get("/admin/sermons", requireAuth, requireEventManagement, async (req, res) => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "Requester not found." });
    return;
  }

  const sermons = await db
    .select()
    .from(sermonsTable)
    .where(eq(sermonsTable.churchId, churchId))
    .orderBy(desc(sermonsTable.sermonDate));

  res.json({ sermons: sermons.map(serializeSermon) });
});

// POST /api/admin/sermons
router.post("/admin/sermons", requireAuth, requireEventManagement, async (req, res) => {
  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "Requester not found." });
    return;
  }

  const body = req.body as Record<string, unknown>;

  const title = requiredText(body.title);
  const youtubeVideoId = requiredText(body.youtubeVideoId);
  const sermonDateRaw = body.sermonDate;

  if (!title) {
    res.status(400).json({ error: "title is required." });
    return;
  }
  if (!youtubeVideoId) {
    res.status(400).json({ error: "youtubeVideoId is required." });
    return;
  }
  if (!sermonDateRaw || typeof sermonDateRaw !== "string") {
    res.status(400).json({ error: "sermonDate is required." });
    return;
  }

  const sermonDate = new Date(sermonDateRaw);
  if (isNaN(sermonDate.getTime())) {
    res.status(400).json({ error: "sermonDate must be a valid date." });
    return;
  }

  const [sermon] = await db
    .insert(sermonsTable)
    .values({
      churchId,
      title,
      speakerName: textOrNull(body.speakerName),
      seriesName: textOrNull(body.seriesName),
      description: textOrNull(body.description),
      youtubeVideoId,
      sermonDate,
      isPublished: body.isPublished === true || body.isPublished === "true",
      createdByUserId: req.localUserId,
    })
    .returning();

  res.status(201).json({ sermon: serializeSermon(sermon) });
});

// PATCH /api/admin/sermons/:id
router.patch("/admin/sermons/:id", requireAuth, requireEventManagement, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid sermon ID." });
    return;
  }

  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "Requester not found." });
    return;
  }

  const [existing] = await db
    .select()
    .from(sermonsTable)
    .where(and(eq(sermonsTable.id, id), eq(sermonsTable.churchId, churchId)));

  if (!existing) {
    res.status(404).json({ error: "Sermon not found." });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const patch: Partial<typeof sermonsTable.$inferInsert> = {};

  if (typeof body.title === "string" && body.title.trim()) patch.title = body.title.trim();
  if (typeof body.speakerName !== "undefined") patch.speakerName = textOrNull(body.speakerName);
  if (typeof body.seriesName !== "undefined") patch.seriesName = textOrNull(body.seriesName);
  if (typeof body.description !== "undefined") patch.description = textOrNull(body.description);
  if (typeof body.youtubeVideoId === "string" && body.youtubeVideoId.trim()) {
    patch.youtubeVideoId = body.youtubeVideoId.trim();
  }
  if (typeof body.sermonDate === "string") {
    const d = new Date(body.sermonDate);
    if (!isNaN(d.getTime())) patch.sermonDate = d;
  }
  if (typeof body.isPublished === "boolean") patch.isPublished = body.isPublished;
  if (body.isPublished === "true") patch.isPublished = true;
  if (body.isPublished === "false") patch.isPublished = false;

  const [updated] = await db
    .update(sermonsTable)
    .set(patch)
    .where(and(eq(sermonsTable.id, id), eq(sermonsTable.churchId, churchId)))
    .returning();

  res.json({ sermon: serializeSermon(updated) });
});

// DELETE /api/admin/sermons/:id
router.delete("/admin/sermons/:id", requireAuth, requireEventManagement, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid sermon ID." });
    return;
  }

  const churchId = await getRequesterChurchId(req.localUserId);
  if (!churchId) {
    res.status(401).json({ error: "Requester not found." });
    return;
  }

  const [deleted] = await db
    .delete(sermonsTable)
    .where(and(eq(sermonsTable.id, id), eq(sermonsTable.churchId, churchId)))
    .returning({ id: sermonsTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Sermon not found." });
    return;
  }

  res.json({ ok: true });
});

export default router;
