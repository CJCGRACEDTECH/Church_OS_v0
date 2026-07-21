import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, donationsTable, givingCampaignsTable } from "@workspace/db";
import {
  CAMPAIGN_STATUSES,
  campaignRaised,
  cents,
  enumValue,
  requireCampaignManagement,
  requireGivingManagement,
  serializeCampaign,
  textOrNull,
} from "./shared";

const router: IRouter = Router();

router.get("/admin/giving/campaigns", requireGivingManagement, async (req, res) => {
  const campaigns = await db.select().from(givingCampaignsTable).where(eq(givingCampaignsTable.churchId, req.localChurchId)).orderBy(desc(givingCampaignsTable.createdAt));
  res.json({ campaigns: await Promise.all(campaigns.map(async (campaign) => serializeCampaign(campaign, await campaignRaised(campaign.id, req.localChurchId)))) });
});

router.post("/admin/giving/campaigns", requireCampaignManagement, async (req, res): Promise<void> => {
  const name = typeof req.body?.campaignName === "string" ? req.body.campaignName.trim() : "";
  if (!name) { res.status(400).json({ error: "Campaign name is required." }); return; }
  const goalAmountDollars = Number(req.body?.goalAmount);
  if (!Number.isFinite(goalAmountDollars) || goalAmountDollars <= 0) {
    res.status(400).json({ error: "Goal amount must be greater than $0." }); return;
  }
  if (req.body?.endDate) {
    const endDate = new Date(req.body.endDate);
    if (isNaN(endDate.getTime())) { res.status(400).json({ error: "End date is invalid." }); return; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (endDate < today) { res.status(400).json({ error: "End date must be today or in the future." }); return; }
  }
  const [campaign] = await db.insert(givingCampaignsTable).values({
    churchId: req.localChurchId,
    campaignName: name,
    description: textOrNull(req.body?.description),
    goalAmountCents: cents(req.body?.goalAmount),
    startDate: req.body?.startDate ? new Date(req.body.startDate) : null,
    endDate: req.body?.endDate ? new Date(req.body.endDate) : null,
    status: enumValue(req.body?.status, CAMPAIGN_STATUSES, "draft"),
    campaignImageUrl: textOrNull(req.body?.campaignImageUrl),
    campaignCategory: textOrNull(req.body?.campaignCategory),
    createdByUserId: req.localUserId,
  }).returning();
  res.status(201).json({ campaign: serializeCampaign(campaign, 0) });
});

router.patch("/admin/giving/campaigns/:id", requireCampaignManagement, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid campaign." }); return; }
  if ("goalAmount" in req.body) {
    const goalAmountDollars = Number(req.body.goalAmount);
    if (!Number.isFinite(goalAmountDollars) || goalAmountDollars <= 0) {
      res.status(400).json({ error: "Goal amount must be greater than $0." }); return;
    }
  }
  if ("endDate" in req.body && req.body.endDate) {
    const endDate = new Date(req.body.endDate);
    if (isNaN(endDate.getTime())) { res.status(400).json({ error: "End date is invalid." }); return; }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (endDate < today) { res.status(400).json({ error: "End date must be today or in the future." }); return; }
  }
  const [campaign] = await db.update(givingCampaignsTable).set({
    campaignName: typeof req.body?.campaignName === "string" ? req.body.campaignName.trim() : undefined,
    description: textOrNull(req.body?.description),
    goalAmountCents: req.body?.goalAmount ? cents(req.body.goalAmount) : undefined,
    startDate: "startDate" in req.body ? (req.body.startDate ? new Date(req.body.startDate) : null) : undefined,
    endDate: "endDate" in req.body ? (req.body.endDate ? new Date(req.body.endDate) : null) : undefined,
    status: enumValue(req.body?.status, CAMPAIGN_STATUSES, "draft"),
    campaignImageUrl: textOrNull(req.body?.campaignImageUrl),
    campaignCategory: textOrNull(req.body?.campaignCategory),
  }).where(and(eq(givingCampaignsTable.id, id), eq(givingCampaignsTable.churchId, req.localChurchId))).returning();
  if (!campaign) { res.status(404).json({ error: "Campaign not found." }); return; }
  res.json({ campaign: serializeCampaign(campaign, await campaignRaised(campaign.id, req.localChurchId)) });
});

router.delete("/admin/giving/campaigns/:id", requireCampaignManagement, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: "Invalid campaign." }); return; }

  const [campaign] = await db
    .select({ id: givingCampaignsTable.id })
    .from(givingCampaignsTable)
    .where(and(eq(givingCampaignsTable.id, id), eq(givingCampaignsTable.churchId, req.localChurchId)));
  if (!campaign) { res.status(404).json({ error: "Campaign not found." }); return; }

  const linkedDonations = await db
    .select({ id: donationsTable.id })
    .from(donationsTable)
    .where(and(eq(donationsTable.campaignId, id), eq(donationsTable.churchId, req.localChurchId)))
    .limit(1);

  if (linkedDonations.length > 0) {
    res.status(409).json({ error: "Campaign has donation history. Deactivate it instead to preserve financial records." });
    return;
  }

  await db.delete(givingCampaignsTable).where(and(eq(givingCampaignsTable.id, id), eq(givingCampaignsTable.churchId, req.localChurchId)));
  res.json({ ok: true });
});

export default router;
