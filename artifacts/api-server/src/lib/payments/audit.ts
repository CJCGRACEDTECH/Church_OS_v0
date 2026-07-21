import { db, givingAuditLogTable } from "@workspace/db";

type AuditAction = typeof givingAuditLogTable.$inferInsert.action;
type AuditEntityType = typeof givingAuditLogTable.$inferInsert.entityType;

export async function writeAudit(params: {
  churchId: number;
  actorUserId: number | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: number;
  before?: unknown;
  after?: unknown;
  note?: string | null;
}) {
  await db.insert(givingAuditLogTable).values({
    churchId: params.churchId,
    actorUserId: params.actorUserId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    before: params.before ?? null,
    after: params.after ?? null,
    note: params.note ?? null,
  });
}
