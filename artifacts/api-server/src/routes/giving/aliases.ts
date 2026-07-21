import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, memberPaymentAliasesTable, usersTable, ALIAS_TYPES } from "@workspace/db";
import { writeAudit } from "../../lib/payments/audit";
import { normalizeAliasValueFor } from "../../lib/payments/matching";
import { enumValue, requireGivingManagement, textOrNull } from "./shared";

const router: IRouter = Router();
const ALIAS_TYPE_SET = new Set<string>(ALIAS_TYPES);

function serializeAlias(alias: typeof memberPaymentAliasesTable.$inferSelect) {
  return {
    id: alias.id,
    memberId: alias.memberId,
    aliasType: alias.aliasType,
    aliasValue: alias.aliasValue,
    verified: alias.verified,
    createdAt: alias.createdAt.toISOString(),
  };
}

router.get("/admin/members/:id/payment-aliases", requireGivingManagement, async (req, res): Promise<void> => {
  const memberId = Number(req.params.id);
  if (!Number.isInteger(memberId)) { res.status(400).json({ error: "Invalid member." }); return; }
  const aliases = await db.select().from(memberPaymentAliasesTable)
    .where(and(eq(memberPaymentAliasesTable.memberId, memberId), eq(memberPaymentAliasesTable.churchId, req.localChurchId)));
  res.json({ aliases: aliases.map(serializeAlias) });
});

router.post("/admin/members/:id/payment-aliases", requireGivingManagement, async (req, res): Promise<void> => {
  const memberId = Number(req.params.id);
  if (!Number.isInteger(memberId)) { res.status(400).json({ error: "Invalid member." }); return; }

  const [member] = await db.select({ id: usersTable.id }).from(usersTable)
    .where(and(eq(usersTable.id, memberId), eq(usersTable.churchId, req.localChurchId)));
  if (!member) { res.status(404).json({ error: "Member not found." }); return; }

  const aliasType = enumValue(req.body?.aliasType, ALIAS_TYPE_SET, "other");
  const aliasValue = textOrNull(req.body?.aliasValue);
  if (!aliasValue) { res.status(400).json({ error: "Alias value is required." }); return; }

  const [alias] = await db.insert(memberPaymentAliasesTable).values({
    churchId: req.localChurchId,
    memberId,
    aliasType,
    aliasValue,
    normalizedValue: normalizeAliasValueFor(aliasType, aliasValue),
    createdByUserId: req.localUserId,
  }).onConflictDoNothing({
    target: [memberPaymentAliasesTable.churchId, memberPaymentAliasesTable.aliasType, memberPaymentAliasesTable.normalizedValue],
  }).returning();

  if (!alias) { res.status(409).json({ error: "This alias is already saved for a member." }); return; }

  await writeAudit({
    churchId: req.localChurchId,
    actorUserId: req.localUserId,
    action: "alias_created",
    entityType: "alias",
    entityId: alias.id,
    after: serializeAlias(alias),
  });

  res.status(201).json({ alias: serializeAlias(alias) });
});

router.delete("/admin/members/:memberId/payment-aliases/:aliasId", requireGivingManagement, async (req, res): Promise<void> => {
  const memberId = Number(req.params.memberId);
  const aliasId = Number(req.params.aliasId);
  if (!Number.isInteger(memberId) || !Number.isInteger(aliasId)) { res.status(400).json({ error: "Invalid request." }); return; }

  const [alias] = await db.select().from(memberPaymentAliasesTable)
    .where(and(eq(memberPaymentAliasesTable.id, aliasId), eq(memberPaymentAliasesTable.memberId, memberId), eq(memberPaymentAliasesTable.churchId, req.localChurchId)));
  if (!alias) { res.status(404).json({ error: "Alias not found." }); return; }

  await db.delete(memberPaymentAliasesTable).where(eq(memberPaymentAliasesTable.id, aliasId));

  await writeAudit({
    churchId: req.localChurchId,
    actorUserId: req.localUserId,
    action: "alias_deleted",
    entityType: "alias",
    entityId: aliasId,
    before: serializeAlias(alias),
  });

  res.json({ ok: true });
});

export default router;
