/**
 * Seed script — creates demo church, admin user, and member user.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run seed          # upsert only
 *   pnpm --filter @workspace/scripts run seed --reset  # wipe users/churches first, then seed
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq } from "drizzle-orm";
import * as schema from "@workspace/db";
import bcrypt from "bcryptjs";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const CHURCH = { name: "CJC International", slug: "cjc-international" };
const USERS = [
  {
    email: "admin@churchos.test",
    password: "Admin123!",
    firstName: "Church",
    lastName: "Admin",
    role: "admin" as const,
  },
  {
    email: "member@churchos.test",
    password: "Member123!",
    firstName: "Church",
    lastName: "Member",
    role: "member" as const,
  },
];

async function seed() {
  const isReset = process.argv.includes("--reset");

  if (isReset) {
    console.log("🗑️  Resetting users and churches...");
    await db.delete(schema.usersTable);
    await db.delete(schema.churchesTable);
    console.log("   Done.");
  }

  console.log("🌱 Seeding church...");
  const [church] = await db
    .insert(schema.churchesTable)
    .values(CHURCH)
    .onConflictDoUpdate({ target: schema.churchesTable.slug, set: { name: CHURCH.name } })
    .returning();
  console.log(`   Church: ${church.name} (id=${church.id})`);

  console.log("🌱 Seeding users...");
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    const [user] = await db
      .insert(schema.usersTable)
      .values({ ...u, passwordHash, churchId: church.id })
      .onConflictDoUpdate({
        target: schema.usersTable.email,
        set: { passwordHash, firstName: u.firstName, lastName: u.lastName, role: u.role },
      })
      .returning();
    console.log(`   ${user.role}: ${user.email} (id=${user.id})`);
  }

  console.log("✅ Seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  pool.end();
  process.exit(1);
});
