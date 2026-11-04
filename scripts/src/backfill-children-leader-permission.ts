/**
 * One-time backfill for the Children Ministry Leader permission.
 *
 * Before `children_ministry_manage` existed, `attendance_checkin` allowed every
 * Children Ministry action. Run this once after deploying so admins who had
 * check-in access keep registering, editing, and history access. Afterwards,
 * remove the Leader permission from anyone who should only check children in
 * and out (for example teen helpers).
 *
 * Safe to re-run: admins who already have the permission are skipped.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run backfill:children-leader
 */
import { and, eq, notInArray } from "drizzle-orm";
import { adminPermissionsTable, db, pool } from "@workspace/db";

async function backfill() {
  const alreadyLeaders = db
    .select({ userId: adminPermissionsTable.userId })
    .from(adminPermissionsTable)
    .where(eq(adminPermissionsTable.permission, "children_ministry_manage"));

  const checkInAdmins = await db
    .select({ userId: adminPermissionsTable.userId, grantedByUserId: adminPermissionsTable.grantedByUserId })
    .from(adminPermissionsTable)
    .where(
      and(
        eq(adminPermissionsTable.permission, "attendance_checkin"),
        notInArray(adminPermissionsTable.userId, alreadyLeaders),
      ),
    );

  if (checkInAdmins.length > 0) {
    await db.insert(adminPermissionsTable).values(
      checkInAdmins.map((admin) => ({
        userId: admin.userId,
        permission: "children_ministry_manage",
        grantedByUserId: admin.grantedByUserId,
      })),
    );
  }

  console.log(`Granted Children Ministry Leader to ${checkInAdmins.length} admin(s).`);
}

backfill()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error);
    await pool.end();
    process.exit(1);
  });
