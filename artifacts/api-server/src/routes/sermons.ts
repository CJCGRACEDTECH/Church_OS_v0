import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, sermonsTable } from "@workspace/db";
import { ADMIN_PERMISSIONS } from "../lib/admin-permissions";
import { requireAdminPermission } from "../middlewares/auth";

const router: IRouter = Router();

const requireEventManagement = requireAdminPermission(ADMIN_PERMISSIONS.EVENT_MANAGEMENT);

router.get("/admin/sermons", requireEventManagement, async (req, res): Promise<void> => {
  const sermons = await db
    .select()
    .from(sermonsTable)
    .where(eq(sermonsTable.churchId, req.localChurchId))
    .orderBy(desc(sermonsTable.sermonDate));

  res.json({ sermons });
});

router.post("/admin/sermons", requireEventManagement, async (req, res): Promise<void> => {
  const { title, speakerName, seriesName, description, youtubeVideoId, sermonDate, isPublished } = req.body as Record<string, unknown>;

  if (!title || typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "Title is required." });
    return;
  }
  if (!youtubeVideoId || typeof youtubeVideoId !== "string" || !youtubeVideoId.trim()) {
    res.status(400).json({ error: "YouTube video ID is required." });
    return;
  }
  if (!sermonDate || (typeof sermonDate !== "string" && !(sermonDate instanceof Date))) {
    res.status(400).json({ error: "Sermon date is required." });
    return;
  }

  const parsedDate = new Date(sermonDate as string);
  if (isNaN(parsedDate.getTime())) {
    res.status(400).json({ error: "Invalid sermon date." });
    return;
  }

  const [sermon] = await db
    .insert(sermonsTable)
    .values({
      churchId: req.localChurchId,
      title: (title as string).trim(),
      speakerName: typeof speakerName === "string" && speakerName.trim() ? speakerName.trim() : null,
      seriesName: typeof seriesName === "string" && seriesName.trim() ? seriesName.trim() : null,
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      youtubeVideoId: (youtubeVideoId as string).trim(),
      sermonDate: parsedDate,
      isPublished: isPublished === true || isPublished === "true",
      createdByUserId: req.localUserId,
    })
    .returning();

  res.status(201).json({ sermon });
});

router.patch("/admin/sermons/:id", requireEventManagement, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid sermon ID." });
    return;
  }

  const [existing] = await db
    .select({ id: sermonsTable.id })
    .from(sermonsTable)
    .where(and(eq(sermonsTable.id, id), eq(sermonsTable.churchId, req.localChurchId)));

  if (!existing) {
    res.status(404).json({ error: "Sermon not found." });
    return;
  }

  const { title, speakerName, seriesName, description, youtubeVideoId, sermonDate, isPublished } = req.body as Record<string, unknown>;

  const updates: Partial<typeof sermonsTable.$inferInsert> = {};
  if (typeof title === "string" && title.trim()) updates.title = title.trim();
  if (typeof speakerName === "string") updates.speakerName = speakerName.trim() || null;
  if (typeof seriesName === "string") updates.seriesName = seriesName.trim() || null;
  if (typeof description === "string") updates.description = description.trim() || null;
  if (typeof youtubeVideoId === "string" && youtubeVideoId.trim()) updates.youtubeVideoId = youtubeVideoId.trim();
  if (sermonDate !== undefined) {
    const parsedDate = new Date(sermonDate as string);
    if (!isNaN(parsedDate.getTime())) updates.sermonDate = parsedDate;
  }
  if (isPublished !== undefined) updates.isPublished = isPublished === true || isPublished === "true";

  const [sermon] = await db
    .update(sermonsTable)
    .set(updates)
    .where(eq(sermonsTable.id, id))
    .returning();

  res.json({ sermon });
});

router.delete("/admin/sermons/:id", requireEventManagement, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) {
    res.status(400).json({ error: "Invalid sermon ID." });
    return;
  }

  const [existing] = await db
    .select({ id: sermonsTable.id })
    .from(sermonsTable)
    .where(and(eq(sermonsTable.id, id), eq(sermonsTable.churchId, req.localChurchId)));

  if (!existing) {
    res.status(404).json({ error: "Sermon not found." });
    return;
  }

  await db.delete(sermonsTable).where(eq(sermonsTable.id, id));
  res.json({ ok: true });
});

export default router;
