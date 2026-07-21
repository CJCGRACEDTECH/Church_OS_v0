import { eq } from "drizzle-orm";
import { db, givingIntentsTable, type GivingIntent, type InsertGivingIntent } from "@workspace/db";

export async function createIntent(values: InsertGivingIntent): Promise<GivingIntent> {
  const [intent] = await db.insert(givingIntentsTable).values(values).returning();
  return intent;
}

export async function setIntentProviderRef(intentId: number, providerRef: string) {
  await db.update(givingIntentsTable).set({ providerRef }).where(eq(givingIntentsTable.id, intentId));
}

export async function setIntentStatus(intentId: number, status: GivingIntent["status"]) {
  await db.update(givingIntentsTable).set({ status }).where(eq(givingIntentsTable.id, intentId));
}

export async function setIntentStatusByProviderRef(providerRef: string, status: GivingIntent["status"]) {
  await db.update(givingIntentsTable).set({ status }).where(eq(givingIntentsTable.providerRef, providerRef));
}
