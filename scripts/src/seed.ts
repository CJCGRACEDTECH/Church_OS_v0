/**
 * Seed script — creates demo church, admin user, and member user.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run seed          # upsert only
 *   pnpm --filter @workspace/scripts run seed --reset  # wipe users/churches first, then seed
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { and, eq } from "drizzle-orm";
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
const SUPER_ADMIN_PERMISSIONS = [
  "attendance_checkin",
  "member_directory",
  "member_profiles",
  "event_management",
  "followup_notes",
  "pastoral_notes",
  "giving_summary",
  "giving_details",
  "reports",
  "admin_management",
  "system_settings",
];

const USERS = [
  {
    email: "admin@churchos.test",
    password: "Admin123!",
    firstName: "Church",
    lastName: "Admin",
    role: "admin" as const,
    adminLevel: "super_admin" as const,
    assignedMinistry: "Executive Leadership",
    accountStatus: "active" as const,
  },
  {
    email: "member@churchos.test",
    password: "Member123!",
    firstName: "Church",
    lastName: "Member",
    role: "member" as const,
    adminLevel: null,
    assignedMinistry: null,
    accountStatus: "active" as const,
  },
];

const CHILDREN = [
  {
    firstName: "Avery",
    lastName: "Johnson",
    dateOfBirth: "2018-04-20",
    gender: "Female",
    classroom: "K-2",
    allergyInformation: "Peanuts",
    medicalNotes: "Inhaler in backpack",
    specialInstructions: "Release only to listed contacts",
    checkinStatus: "checked_out" as const,
    guardians: [
      {
        name: "Morgan Johnson",
        email: "morgan.johnson@example.test",
        phoneNumber: "555-0100",
        relationship: "parent" as const,
        authorizedPickup: true,
      },
      {
        name: "Taylor Friend",
        email: "taylor.friend@example.test",
        phoneNumber: "555-0199",
        relationship: "emergency_contact" as const,
        authorizedPickup: false,
      },
    ],
  },
  {
    firstName: "Noah",
    lastName: "Carter",
    dateOfBirth: "2020-09-15",
    gender: "Male",
    classroom: "Preschool",
    allergyInformation: null,
    medicalNotes: null,
    specialInstructions: "Needs help finding backpack at pickup",
    checkinStatus: "checked_in" as const,
    guardians: [
      {
        name: "Riley Carter",
        email: "riley.carter@example.test",
        phoneNumber: "555-0122",
        relationship: "guardian" as const,
        authorizedPickup: true,
      },
    ],
  },
  {
    firstName: "Maya",
    lastName: "Williams",
    dateOfBirth: "2017-12-03",
    gender: "Female",
    classroom: "3-5",
    allergyInformation: "Dairy sensitivity",
    medicalNotes: null,
    specialInstructions: "Parent prefers text if anything changes",
    checkinStatus: "checked_out" as const,
    guardians: [
      {
        name: "Jordan Williams",
        email: "jordan.williams@example.test",
        phoneNumber: "555-0144",
        relationship: "parent" as const,
        authorizedPickup: true,
      },
      {
        name: "Casey Williams",
        email: "casey.williams@example.test",
        phoneNumber: "555-0177",
        relationship: "parent" as const,
        authorizedPickup: true,
      },
    ],
  },
];

async function seed() {
  const isReset = process.argv.includes("--reset");

  if (isReset) {
    console.log("🗑️  Resetting users and churches...");
    await db.delete(schema.checkinRecordsTable);
    await db.delete(schema.childGuardianRelationshipsTable);
    await db.delete(schema.parentGuardiansTable);
    await db.delete(schema.childrenTable);
    await db.delete(schema.adminPermissionsTable);
    await db.delete(schema.adminInvitationsTable);
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
        set: {
          passwordHash,
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          adminLevel: u.adminLevel,
          assignedMinistry: u.assignedMinistry,
          accountStatus: u.accountStatus,
        },
      })
      .returning();
    console.log(`   ${user.role}${user.adminLevel ? `/${user.adminLevel}` : ""}: ${user.email} (id=${user.id})`);

    if (user.role === "admin" && user.adminLevel === "super_admin") {
      await db.delete(schema.adminPermissionsTable).where(eq(schema.adminPermissionsTable.userId, user.id));
      await db.insert(schema.adminPermissionsTable).values(
        SUPER_ADMIN_PERMISSIONS.map((permission) => ({
          userId: user.id,
          permission,
          grantedByUserId: user.id,
        })),
      );
      console.log(`   permissions: ${SUPER_ADMIN_PERMISSIONS.length} granted`);
    }
  }

  console.log("🌱 Seeding Children Ministry sample data...");
  const [adminUser] = await db
    .select({ id: schema.usersTable.id })
    .from(schema.usersTable)
    .where(eq(schema.usersTable.email, "admin@churchos.test"));

  for (const childInput of CHILDREN) {
    const [existingChild] = await db
      .select()
      .from(schema.childrenTable)
      .where(
        and(
          eq(schema.childrenTable.churchId, church.id),
          eq(schema.childrenTable.firstName, childInput.firstName),
          eq(schema.childrenTable.lastName, childInput.lastName),
          eq(schema.childrenTable.dateOfBirth, childInput.dateOfBirth),
        ),
      );

    const [child] = existingChild
      ? await db
          .update(schema.childrenTable)
          .set({
            gender: childInput.gender,
            classroom: childInput.classroom,
            allergyInformation: childInput.allergyInformation,
            medicalNotes: childInput.medicalNotes,
            specialInstructions: childInput.specialInstructions,
            checkinStatus: childInput.checkinStatus,
          })
          .where(eq(schema.childrenTable.id, existingChild.id))
          .returning()
      : await db
          .insert(schema.childrenTable)
          .values({
            churchId: church.id,
            firstName: childInput.firstName,
            lastName: childInput.lastName,
            dateOfBirth: childInput.dateOfBirth,
            gender: childInput.gender,
            classroom: childInput.classroom,
            allergyInformation: childInput.allergyInformation,
            medicalNotes: childInput.medicalNotes,
            specialInstructions: childInput.specialInstructions,
            checkinStatus: childInput.checkinStatus,
          })
          .returning();

    await db
      .delete(schema.childGuardianRelationshipsTable)
      .where(eq(schema.childGuardianRelationshipsTable.childId, child.id));
    await db
      .delete(schema.checkinRecordsTable)
      .where(eq(schema.checkinRecordsTable.childId, child.id));

    for (const guardianInput of childInput.guardians) {
      const [existingGuardian] = await db
        .select()
        .from(schema.parentGuardiansTable)
        .where(and(eq(schema.parentGuardiansTable.churchId, church.id), eq(schema.parentGuardiansTable.email, guardianInput.email)));

      const [guardian] = existingGuardian
        ? await db
            .update(schema.parentGuardiansTable)
            .set({
              name: guardianInput.name,
              phoneNumber: guardianInput.phoneNumber,
            })
            .where(eq(schema.parentGuardiansTable.id, existingGuardian.id))
            .returning()
        : await db
            .insert(schema.parentGuardiansTable)
            .values({
              churchId: church.id,
              name: guardianInput.name,
              email: guardianInput.email,
              phoneNumber: guardianInput.phoneNumber,
            })
            .returning();

      await db.insert(schema.childGuardianRelationshipsTable).values({
        childId: child.id,
        guardianId: guardian.id,
        relationship: guardianInput.relationship,
        authorizedPickup: guardianInput.authorizedPickup,
      });
    }

    if (childInput.checkinStatus === "checked_in" && adminUser) {
      await db.insert(schema.checkinRecordsTable).values({
        childId: child.id,
        checkedInByUserId: adminUser.id,
        classroom: childInput.classroom,
        pickupCode: "V0DEMO",
        status: "active",
      });
    }

    console.log(`   child: ${child.firstName} ${child.lastName} (${child.classroom})`);
  }

  console.log("✅ Seed complete.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  pool.end();
  process.exit(1);
});
