/**
 * Dev-only seed script — generates a realistic church dataset for testing.
 *
 * SAFETY: This script refuses to run in production.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run seed:dev          # upsert dev data
 *   pnpm --filter @workspace/scripts run seed:dev --reset  # wipe dev data first, then recreate
 *
 * What it creates:
 *   - 3 extra test users: finance@, attendance@, children@
 *   - ~105 generated member records (100+ with varied statuses/ages)
 *   - 32 attendance sessions (4 services × 8 weeks back)
 *   - ~1,500 attendance records across sessions
 *   - 20 children with guardians
 *   - ~100 Sunday check-in records (8 Sundays × ~12 children)
 *   - 25 member donation records, 10 recurring plans, 55 one-time donations
 *
 * Edge cases included:
 *   - Member with no DOB
 *   - Visitor with minimal contact info
 *   - Inactive member with old attendance
 *   - Child missing checkout (active check-in)
 *   - Failed donation
 *   - Pending donation
 *   - Recurring plan in past_due status
 */

if (process.env.NODE_ENV === "production") {
  console.error("❌  Refusing to seed dev data in production.");
  process.exit(1);
}

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { and, eq, like } from "drizzle-orm";
import * as schema from "@workspace/db";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const DEV_EMAIL_DOMAIN = "@devtest.church";
const isReset = process.argv.includes("--reset");

// ─── Name pools ─────────────────────────────────────────────────────────────
const FIRST_M = ["James", "Michael", "David", "Robert", "John", "William", "Christopher", "Matthew", "Daniel", "Anthony", "Mark", "Steven", "Paul", "Andrew", "Kevin", "Brian", "George", "Eric", "Timothy", "Joshua"];
const FIRST_F = ["Mary", "Patricia", "Jennifer", "Linda", "Barbara", "Susan", "Dorothy", "Karen", "Lisa", "Nancy", "Betty", "Margaret", "Sandra", "Ashley", "Emily", "Jessica", "Amanda", "Stephanie", "Melissa", "Rebecca"];
const LAST = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White", "Harris", "Clark", "Lewis", "Robinson", "Walker", "Young"];
const CHILDREN_FIRST = ["Ava", "Liam", "Emma", "Noah", "Olivia", "Ethan", "Sophia", "Mason", "Isabella", "Logan", "Mia", "Lucas", "Charlotte", "Elijah", "Amelia", "Aiden", "Harper", "Oliver", "Evelyn", "Benjamin"];
const CHILDREN_LAST = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez"];
const MINISTRIES = ["Worship Team", "Children Ministry", "Hospitality", "Prayer Team", "Youth Ministry", "Outreach", "Media & Tech", "Ushers", "Small Groups", "Discipleship"];
const SMALL_GROUPS = ["Young Adults", "Young Families", "Northside Cell", "Eastgate Group", "Men's Fellowship", "Women's Circle", "Marriage Ministry", "Senior Saints", "College Group", "Spanish Ministry"];
const CITIES = ["Springfield", "Fairview", "Riverside", "Oakwood", "Maplewood"];
const STATES = ["VA", "MD", "DC", "PA", "NC"];
const CLASSROOMS = ["Toddlers", "Preschool", "Elementary"];
const ALLERGY_POOL = [null, null, null, "Peanuts", "Dairy sensitivity", "Tree nuts", "Gluten-free diet", null, null, "Latex allergy"];
const MEDICAL_POOL = [null, null, null, null, "Inhaler in backpack", "Epipen required", null, null, null, null];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.abs((seed * (i + 1) * 1103515245 + 12345) % (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function randomInt(seed: number, min: number, max: number): number {
  return min + Math.abs(seed * 1103515245 + 12345) % (max - min + 1);
}

/** Returns dates of the last `count` occurrences of a given day-of-week (0=Sun) */
function pastDayOccurrences(dayOfWeek: number, count: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates: Date[] = [];
  const current = new Date(today);
  current.setDate(current.getDate() - 1); // start from yesterday
  while (dates.length < count) {
    if (current.getDay() === dayOfWeek) dates.push(new Date(current));
    current.setDate(current.getDate() - 1);
  }
  return dates;
}

function makeQrToken(suffix: string): string {
  return `qr_dev_${Date.now()}_${suffix.replace(/\s/g, "_")}`;
}

function makePickupCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function dobFromAge(ageYears: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - ageYears);
  return d.toISOString().slice(0, 10);
}

// ─── Test users beyond admin@ and member@ ───────────────────────────────────
const EXTRA_TEST_USERS = [
  {
    email: "finance@churchos.test",
    firstName: "Finance",
    lastName: "Lead",
    role: "admin" as const,
    adminLevel: "pastor" as const,
    accountStatus: "active" as const,
    memberStatus: "active_member" as const,
    assignedMinistry: "Finance",
    servingStatus: "serving" as const,
    baptismStatus: "baptized" as const,
    permissions: ["giving_summary", "giving_details", "giving_view_own", "giving_management", "giving_reports", "campaign_management"],
  },
  {
    email: "attendance@churchos.test",
    firstName: "Attendance",
    lastName: "Lead",
    role: "admin" as const,
    adminLevel: "minister" as const,
    accountStatus: "active" as const,
    memberStatus: "active_member" as const,
    assignedMinistry: "Administration",
    servingStatus: "serving" as const,
    baptismStatus: "baptized" as const,
    permissions: ["attendance_checkin", "attendance_management", "member_directory"],
  },
  {
    email: "children@churchos.test",
    firstName: "Children",
    lastName: "Lead",
    role: "admin" as const,
    adminLevel: "minister" as const,
    accountStatus: "active" as const,
    memberStatus: "active_member" as const,
    assignedMinistry: "Children Ministry",
    servingStatus: "serving" as const,
    baptismStatus: "baptized" as const,
    permissions: ["attendance_checkin", "member_directory"],
  },
];

// ─── Member status distribution ──────────────────────────────────────────────
type MemberStatus = "active_member" | "member" | "visitor" | "inactive";
type AccountStatus = "active" | "pending" | "disabled";

function memberStatusForIndex(i: number): MemberStatus {
  if (i < 70) return "active_member";
  if (i < 82) return "inactive";
  if (i < 92) return "visitor";
  if (i < 100) return "member"; // recently joined
  return "active_member"; // ministry leaders
}

function accountStatusForMember(ms: MemberStatus): AccountStatus {
  if (ms === "inactive") return "disabled";
  if (ms === "visitor") return "pending";
  return "active";
}

// DOB for age variation: first 10 = teens (13-17), next 50 = adults (18-59), rest = seniors (60+)
function dobForIndex(i: number): string | null {
  if (i === 77) return null; // edge case: member with no DOB
  if (i < 10) return dobFromAge(13 + (i % 5));
  if (i < 65) return dobFromAge(18 + (i % 42));
  return dobFromAge(60 + (i % 25));
}

async function seedDev() {
  console.log("\n🌱 Church OS — Dev Seed Script");
  console.log("================================\n");

  if (process.env.NODE_ENV === "production") {
    console.error("❌  Refusing to seed dev data in production.");
    process.exit(1);
  }

  // ── Find the church ──────────────────────────────────────────────────────
  const [church] = await db.select().from(schema.churchesTable).where(eq(schema.churchesTable.slug, "cjc-international"));
  if (!church) {
    console.error("❌  Church 'cjc-international' not found. Run the base seed first:");
    console.error("    pnpm --filter @workspace/scripts run seed");
    process.exit(1);
  }
  console.log(`✅  Church: ${church.name} (id=${church.id})`);

  // ── Optional reset: wipe dev data ────────────────────────────────────────
  if (isReset) {
    console.log("\n🗑️  Resetting dev data (keeping admin@ and member@ accounts)...");
    const devUsers = await db.select({ id: schema.usersTable.id })
      .from(schema.usersTable)
      .where(like(schema.usersTable.email, `%${DEV_EMAIL_DOMAIN}`));
    const testUsers = await db.select({ id: schema.usersTable.id })
      .from(schema.usersTable)
      .where(like(schema.usersTable.email, "%@churchos.test"));

    const devUserIds = [...devUsers, ...testUsers.filter(u => !["admin@churchos.test", "member@churchos.test"].includes(""))].map(u => u.id);

    if (devUserIds.length > 0) {
      for (const uid of devUserIds) {
        await db.delete(schema.attendanceRecordsTable).where(eq(schema.attendanceRecordsTable.memberId, uid));
        await db.delete(schema.donationsTable).where(eq(schema.donationsTable.memberId, uid));
        await db.delete(schema.recurringDonationsTable).where(eq(schema.recurringDonationsTable.memberId, uid));
      }
    }

    // Wipe dev attendance sessions (those with qrToken starting with qr_dev_)
    const devSessions = await db.select({ id: schema.attendanceSessionsTable.id })
      .from(schema.attendanceSessionsTable)
      .where(and(eq(schema.attendanceSessionsTable.churchId, church.id), like(schema.attendanceSessionsTable.qrToken, "qr_dev_%")));
    for (const session of devSessions) {
      await db.delete(schema.attendanceRecordsTable).where(eq(schema.attendanceRecordsTable.sessionId, session.id));
      await db.delete(schema.attendanceSessionsTable).where(eq(schema.attendanceSessionsTable.id, session.id));
    }

    // Wipe dev children + check-in records
    const devChildren = await db.select({ id: schema.childrenTable.id })
      .from(schema.childrenTable)
      .where(and(eq(schema.childrenTable.churchId, church.id), like(schema.childrenTable.firstName, "Dev_%")));
    for (const child of devChildren) {
      await db.delete(schema.checkinRecordsTable).where(eq(schema.checkinRecordsTable.childId, child.id));
      await db.delete(schema.childGuardianRelationshipsTable).where(eq(schema.childGuardianRelationshipsTable.childId, child.id));
    }
    if (devChildren.length > 0) {
      for (const c of devChildren) await db.delete(schema.childrenTable).where(eq(schema.childrenTable.id, c.id));
    }

    // Wipe dev users
    const devMemberList = await db.select({ id: schema.usersTable.id })
      .from(schema.usersTable)
      .where(like(schema.usersTable.email, `%${DEV_EMAIL_DOMAIN}`));
    for (const u of devMemberList) await db.delete(schema.usersTable).where(eq(schema.usersTable.id, u.id));

    // Wipe test users except admin@ and member@
    for (const tu of EXTRA_TEST_USERS) {
      await db.delete(schema.adminPermissionsTable).where(
        eq(schema.adminPermissionsTable.userId, (await db.select({ id: schema.usersTable.id }).from(schema.usersTable).where(eq(schema.usersTable.email, tu.email)))[0]?.id ?? -1)
      );
      await db.delete(schema.usersTable).where(eq(schema.usersTable.email, tu.email));
    }

    console.log("   Dev data cleared.\n");
  }

  // ── Extra test users ─────────────────────────────────────────────────────
  console.log("👤  Seeding extra test users...");
  const [adminUser] = await db.select({ id: schema.usersTable.id }).from(schema.usersTable).where(eq(schema.usersTable.email, "admin@churchos.test"));

  for (const u of EXTRA_TEST_USERS) {
    const [user] = await db
      .insert(schema.usersTable)
      .values({
        churchId: church.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        adminLevel: u.adminLevel,
        accountStatus: u.accountStatus,
        memberStatus: u.memberStatus,
        assignedMinistry: u.assignedMinistry,
        servingStatus: u.servingStatus,
        baptismStatus: u.baptismStatus,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: schema.usersTable.email,
        set: {
          firstName: u.firstName,
          lastName: u.lastName,
          role: u.role,
          adminLevel: u.adminLevel,
          accountStatus: u.accountStatus,
        },
      })
      .returning();

    await db.delete(schema.adminPermissionsTable).where(eq(schema.adminPermissionsTable.userId, user.id));
    if (u.permissions.length > 0) {
      await db.insert(schema.adminPermissionsTable).values(
        u.permissions.map((permission) => ({ userId: user.id, permission, grantedByUserId: adminUser?.id ?? user.id }))
      );
    }

    console.log(`   ${user.role}/${user.adminLevel}: ${user.email}`);
  }

  // ── Bulk member generation ────────────────────────────────────────────────
  console.log("\n👥  Seeding 105 generated members...");
  const generatedUserIds: number[] = [];
  const membersByIndex: Array<{ id: number; memberStatus: MemberStatus }> = [];

  for (let i = 0; i < 105; i++) {
    const gender = i % 2 === 0 ? "Male" : "Female";
    const firstName = pick(gender === "Male" ? FIRST_M : FIRST_F, i);
    const lastName = pick(LAST, Math.floor(i / 2));
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}${DEV_EMAIL_DOMAIN}`;
    const ms = memberStatusForIndex(i);
    const accountStatus = accountStatusForMember(ms);
    const dob = dobForIndex(i);

    const [user] = await db
      .insert(schema.usersTable)
      .values({
        churchId: church.id,
        email,
        firstName,
        lastName,
        role: "member",
        adminLevel: null,
        accountStatus,
        memberStatus: ms,
        isActive: accountStatus === "active",
        dateOfBirth: dob,
        gender,
        phoneNumber: `555-${String(1000 + i).slice(-4)}`,
        assignedMinistry: i >= 100 ? pick(MINISTRIES, i) : null,
        ministryDepartment: i % 5 === 0 ? pick(MINISTRIES, i + 1) : null,
        smallGroup: ms === "active_member" && i % 3 === 0 ? pick(SMALL_GROUPS, i) : null,
        servingStatus: ms === "active_member" ? (i % 3 === 0 ? "serving" : "not_serving") : "not_serving",
        baptismStatus: ms === "visitor" ? "unknown" : i % 4 === 0 ? "not_baptized" : "baptized",
        joinDate: ms !== "visitor" ? "2022-09-01" : null,
        streetAddress: ms !== "visitor" ? `${100 + i} Faith Street` : null,
        city: pick(CITIES, i),
        state: pick(STATES, i),
        zipCode: `221${String(50 + (i % 50)).padStart(2, "0")}`,
        preferredContactMethod: (["email", "text", "phone"] as const)[i % 3],
        emergencyContactName: ms !== "visitor" ? `Emergency Contact ${i}` : null,
        emergencyContactPhoneNumber: ms !== "visitor" ? `555-9${String(100 + i).slice(-3)}` : null,
        emergencyContactRelationship: ms !== "visitor" ? "Family" : null,
      })
      .onConflictDoUpdate({
        target: schema.usersTable.email,
        set: {
          firstName,
          lastName,
          memberStatus: ms,
          accountStatus,
          isActive: accountStatus === "active",
        },
      })
      .returning();

    generatedUserIds.push(user.id);
    membersByIndex.push({ id: user.id, memberStatus: ms });
  }

  const allMembers = await db.select({ id: schema.usersTable.id, email: schema.usersTable.email, memberStatus: schema.usersTable.memberStatus })
    .from(schema.usersTable)
    .where(eq(schema.usersTable.churchId, church.id));

  const activeMembers = allMembers.filter(m => m.memberStatus === "active_member" || m.memberStatus === "member");
  const inactiveMembers = allMembers.filter(m => m.memberStatus === "inactive");
  const visitors = allMembers.filter(m => m.memberStatus === "visitor");

  console.log(`   Created/updated ${generatedUserIds.length} members`);
  console.log(`   Total members in church: ${allMembers.length}`);

  // ── Attendance sessions (32 sessions: 4 services × 8 weeks) ──────────────
  console.log("\n📅  Seeding 32 attendance sessions (4 services × 8 weeks)...");

  const serviceEvents = await db.select({ id: schema.eventsTable.id, title: schema.eventsTable.title, recurrenceDay: schema.eventsTable.recurrenceDay })
    .from(schema.eventsTable)
    .where(and(eq(schema.eventsTable.churchId, church.id), eq(schema.eventsTable.eventType, "service")));

  const servicesByDay = new Map<number, { id: number; title: string }>();
  for (const ev of serviceEvents) {
    if (ev.recurrenceDay !== null) {
      servicesByDay.set(ev.recurrenceDay, { id: ev.id, title: ev.title });
    }
  }

  // Day-of-week → expected attendance range
  const attendanceRanges: Record<number, [number, number]> = {
    4: [35, 55],   // Thursday
    5: [45, 70],   // Friday
    6: [50, 75],   // Saturday
    0: [75, 100],  // Sunday
  };

  const serviceDays = [4, 5, 6, 0];
  const serviceStartTimes: Record<number, string> = { 4: "19:00", 5: "19:00", 6: "19:00", 0: "11:00" };

  const allCreatedSessions: Array<{ id: number; dayOfWeek: number; sessionDate: Date }> = [];

  for (const dayOfWeek of serviceDays) {
    const eventInfo = servicesByDay.get(dayOfWeek);
    const pastDates = pastDayOccurrences(dayOfWeek, 8);
    const range = attendanceRanges[dayOfWeek] ?? [40, 60];

    for (let w = 0; w < pastDates.length; w++) {
      const sessionDate = pastDates[w];
      const qrToken = makeQrToken(`d${dayOfWeek}_w${w}`);

      const sessionValues = {
        churchId: church.id,
        attendanceType: "regular_service" as const,
        serviceEventId: eventInfo?.id ?? null,
        sessionName: eventInfo?.title ?? `Service (Day ${dayOfWeek})`,
        sessionDate,
        startTime: serviceStartTimes[dayOfWeek],
        location: "Main Sanctuary",
        qrToken,
        qrEnabled: true,
        qrExpiration: new Date(sessionDate.getTime() + 4 * 3600_000),
        sessionStatus: "closed" as const,
        createdByUserId: adminUser?.id ?? null,
      };

      const existing = await db.select({ id: schema.attendanceSessionsTable.id })
        .from(schema.attendanceSessionsTable)
        .where(and(
          eq(schema.attendanceSessionsTable.churchId, church.id),
          eq(schema.attendanceSessionsTable.sessionDate, sessionDate),
          eq(schema.attendanceSessionsTable.sessionName, sessionValues.sessionName),
        ));

      let sessionId: number;
      if (existing[0]) {
        sessionId = existing[0].id;
      } else {
        const [session] = await db.insert(schema.attendanceSessionsTable).values(sessionValues).returning();
        sessionId = session.id;
      }

      allCreatedSessions.push({ id: sessionId, dayOfWeek, sessionDate });

      // Generate attendance records for this session
      const targetCount = randomInt(sessionId, range[0], range[1]);
      const shuffledMembers = shuffle(activeMembers, sessionId + w);
      const attendees = shuffledMembers.slice(0, Math.min(targetCount, shuffledMembers.length));

      // Add a few inactive members occasionally
      if (dayOfWeek === 0 && w > 4 && inactiveMembers.length > 0) {
        attendees.push(inactiveMembers[0]); // edge case: inactive member with old attendance
      }

      for (const attendee of attendees) {
        const checkinTime = new Date(sessionDate);
        checkinTime.setHours(parseInt(serviceStartTimes[dayOfWeek]), Math.floor(Math.random() * 30), 0, 0);
        await db.insert(schema.attendanceRecordsTable)
          .values({
            sessionId,
            memberId: attendee.id,
            attendanceStatus: "present",
            checkinSource: Math.random() > 0.3 ? "manual_admin" : "qr_self_checkin",
            checkinTime,
            checkedInByUserId: adminUser?.id ?? attendee.id,
          })
          .onConflictDoNothing();
      }
    }
  }

  const sundaySessions = allCreatedSessions.filter(s => s.dayOfWeek === 0).sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime());

  console.log(`   Created ${allCreatedSessions.length} sessions`);

  // ── Children (20) with guardians ─────────────────────────────────────────
  console.log("\n👶  Seeding 20 children with guardians...");

  const createdChildren: Array<{ id: number; guardianIds: number[] }> = [];

  for (let i = 0; i < 20; i++) {
    const firstName = `Dev_${pick(CHILDREN_FIRST, i)}`;
    const lastName = pick(CHILDREN_LAST, i);
    const ageYears = 2 + (i % 11); // ages 2-12
    const dob = dobFromAge(ageYears);
    const classroom = ageYears <= 3 ? "Toddlers" : ageYears <= 5 ? "Preschool" : "Elementary";
    const allergy = ALLERGY_POOL[i % ALLERGY_POOL.length];
    const medical = MEDICAL_POOL[i % MEDICAL_POOL.length];

    const [child] = await db.insert(schema.childrenTable)
      .values({
        churchId: church.id,
        firstName,
        lastName,
        dateOfBirth: dob,
        gender: i % 2 === 0 ? "Male" : "Female",
        classroom,
        allergyInformation: allergy,
        medicalNotes: medical,
        specialInstructions: i === 0 ? "Release only to listed contacts" : null,
        checkinStatus: "checked_out",
      })
      .onConflictDoNothing()
      .returning();

    if (!child) continue;

    // Each child gets 1-2 guardians
    const parentUser = activeMembers[i % activeMembers.length];
    const guardianIds: number[] = [];

    const [guardian1] = await db.insert(schema.parentGuardiansTable)
      .values({
        churchId: church.id,
        name: `${pick(FIRST_M, i)} ${pick(LAST, i)}`,
        email: `guardian${i}${DEV_EMAIL_DOMAIN}`,
        phoneNumber: `555-G${String(100 + i).slice(-3)}`,
      })
      .onConflictDoNothing()
      .returning();

    if (guardian1) {
      await db.insert(schema.childGuardianRelationshipsTable)
        .values({ childId: child.id, guardianId: guardian1.id, relationship: "parent", authorizedPickup: true })
        .onConflictDoNothing();
      guardianIds.push(guardian1.id);
    }

    // Second guardian for children 0-9 (two-parent households)
    if (i < 10) {
      const [guardian2] = await db.insert(schema.parentGuardiansTable)
        .values({
          churchId: church.id,
          name: `${pick(FIRST_F, i)} ${pick(LAST, i)}`,
          email: `guardian_b${i}${DEV_EMAIL_DOMAIN}`,
          phoneNumber: `555-H${String(100 + i).slice(-3)}`,
        })
        .onConflictDoNothing()
        .returning();

      if (guardian2) {
        await db.insert(schema.childGuardianRelationshipsTable)
          .values({
            childId: child.id,
            guardianId: guardian2.id,
            relationship: "parent",
            authorizedPickup: i !== 5, // edge case: one parent NOT authorized pickup
          })
          .onConflictDoNothing();
        guardianIds.push(guardian2.id);
      }
    }

    createdChildren.push({ id: child.id, guardianIds });
  }

  console.log(`   Created ${createdChildren.length} children`);

  // ── Children check-in records (Sunday sessions only) ─────────────────────
  console.log("\n✅  Seeding children check-in records for 8 Sundays...");

  let totalCheckins = 0;

  for (let si = 0; si < sundaySessions.length; si++) {
    const session = sundaySessions[si];
    const childCount = randomInt(si + 7, 10, 18);
    const shuffledChildren = shuffle(createdChildren, si * 13);
    const checkinChildren = shuffledChildren.slice(0, Math.min(childCount, shuffledChildren.length));

    for (const childData of checkinChildren) {
      const checkinTime = new Date(session.sessionDate);
      checkinTime.setHours(10, 30 + Math.floor(Math.random() * 30), 0, 0);

      const hasCheckout = !(si === sundaySessions.length - 1 && checkinChildren.indexOf(childData) < 2); // last session: leave 2 without checkout (edge case)
      const checkoutTime = hasCheckout ? new Date(checkinTime.getTime() + 90 * 60_000) : null;
      const firstGuardianId = childData.guardianIds[0] ?? null;

      await db.insert(schema.checkinRecordsTable)
        .values({
          childId: childData.id,
          checkedInByUserId: adminUser?.id ?? 1,
          checkedOutByUserId: hasCheckout ? (adminUser?.id ?? null) : null,
          pickedUpByGuardianId: hasCheckout ? firstGuardianId : null,
          checkinTime,
          checkoutTime,
          classroom: "Elementary",
          pickupCode: makePickupCode(),
          status: hasCheckout ? "checked_out" : "active",
        })
        .onConflictDoNothing();

      totalCheckins++;
    }
  }

  console.log(`   Created ${totalCheckins} check-in records`);

  // Update checkin status for any children left in "active" state
  await db.update(schema.childrenTable)
    .set({ checkinStatus: "checked_in" })
    .where(and(
      eq(schema.childrenTable.churchId, church.id),
      // Children from the last Sunday session without checkout
      // (approximated: just pick the first dev child for the edge case)
      like(schema.childrenTable.firstName, "Dev_%"),
    ));
  // Reset all but edge cases to checked_out
  const allDevChildren = await db.select({ id: schema.childrenTable.id }).from(schema.childrenTable).where(and(eq(schema.childrenTable.churchId, church.id), like(schema.childrenTable.firstName, "Dev_%")));
  for (const c of allDevChildren) {
    const activeRecord = await db.select({ id: schema.checkinRecordsTable.id }).from(schema.checkinRecordsTable).where(and(eq(schema.checkinRecordsTable.childId, c.id), eq(schema.checkinRecordsTable.status, "active")));
    if (activeRecord.length === 0) {
      await db.update(schema.childrenTable).set({ checkinStatus: "checked_out" }).where(eq(schema.childrenTable.id, c.id));
    }
  }

  // ── Giving campaigns ──────────────────────────────────────────────────────
  console.log("\n💰  Seeding giving campaigns...");

  const DEV_CAMPAIGNS = [
    { campaignName: "Annual Building Fund 2026", description: "Expand our main sanctuary to seat 600 people.", goalAmountCents: 15_000_000, startDate: new Date("2026-01-01"), endDate: new Date("2026-12-31"), status: "active" as const, campaignCategory: "Building Fund" },
    { campaignName: "Uganda Missions 2026", description: "Support our team traveling to Kampala for outreach.", goalAmountCents: 4_500_000, startDate: new Date("2026-03-01"), endDate: new Date("2026-09-30"), status: "active" as const, campaignCategory: "Missions" },
  ];

  const campaignIdMap = new Map<string, number>();
  for (const camp of DEV_CAMPAIGNS) {
    const existing = await db.select({ id: schema.givingCampaignsTable.id }).from(schema.givingCampaignsTable).where(and(eq(schema.givingCampaignsTable.churchId, church.id), eq(schema.givingCampaignsTable.campaignName, camp.campaignName)));
    const [campaign] = existing[0]
      ? await db.update(schema.givingCampaignsTable).set({ ...camp, churchId: church.id, createdByUserId: adminUser?.id ?? null }).where(eq(schema.givingCampaignsTable.id, existing[0].id)).returning()
      : await db.insert(schema.givingCampaignsTable).values({ ...camp, churchId: church.id, createdByUserId: adminUser?.id ?? null }).returning();
    campaignIdMap.set(campaign.campaignName, campaign.id);
    console.log(`   campaign: ${campaign.campaignName}`);
  }

  // ── Donations (55 one-time + 10 recurring) ────────────────────────────────
  console.log("\n💳  Seeding donations...");

  const GIVING_CATEGORIES = ["tithe", "offering", "building_fund", "missions", "special_campaign", "other"] as const;

  // 25 members with donation records
  const givingMembers = shuffle(activeMembers, 42).slice(0, 25);
  // 10 of them get recurring plans
  const recurringMembers = givingMembers.slice(0, 10);

  const recurringAmounts = [5000, 7500, 10000, 12500, 15000, 8000, 9000, 6000, 11000, 20000];
  let donationCount = 0;
  let recurringCount = 0;

  // One-time donations (multiple per member, spread over 8 weeks)
  for (let di = 0; di < givingMembers.length; di++) {
    const donor = givingMembers[di];
    const donationCount_this_member = 1 + (di % 3); // 1-3 donations per member

    for (let k = 0; k < donationCount_this_member; k++) {
      const weeksAgo = k * 2 + (di % 4);
      const donationDate = new Date(Date.now() - weeksAgo * 7 * 24 * 3600_000);
      const amountCents = randomInt(di * 7 + k, 1000, 100000); // $10 - $1000
      const category = GIVING_CATEGORIES[di % GIVING_CATEGORIES.length];
      const paymentStatus = di === 20 ? "failed" : di === 21 ? "pending" : "succeeded"; // edge cases

      const campaignId = category === "building_fund" ? (campaignIdMap.get("Annual Building Fund 2026") ?? null)
        : category === "missions" ? (campaignIdMap.get("Uganda Missions 2026") ?? null)
        : null;

      const csId = `cs_test_dev_${di}_${k}_${donor.id}`;
      const piId = `pi_test_dev_${di}_${k}_${donor.id}`;

      const existing = await db.select({ id: schema.donationsTable.id }).from(schema.donationsTable).where(eq(schema.donationsTable.stripeCheckoutSessionId, csId));
      if (!existing[0]) {
        await db.insert(schema.donationsTable).values({
          churchId: church.id,
          memberId: donor.id,
          donorName: `Dev Member ${di}`,
          donorEmail: donor.email,
          amountCents,
          donationDate,
          donationType: "one_time",
          givingCategory: category,
          campaignId,
          stripeCheckoutSessionId: csId,
          stripePaymentIntentId: piId,
          stripeReceiptUrl: paymentStatus === "succeeded" ? `https://pay.stripe.com/receipts/test_${piId}` : null,
          paymentStatus,
          taxDeductible: true,
          receiptIssued: paymentStatus === "succeeded" && di % 3 === 0,
        });
        donationCount++;
      }
    }
  }

  // Visitor one-time gift (edge case: visitor giving)
  if (visitors.length > 0) {
    const visitor = visitors[0];
    const csId = `cs_test_dev_visitor_0`;
    const existing = await db.select({ id: schema.donationsTable.id }).from(schema.donationsTable).where(eq(schema.donationsTable.stripeCheckoutSessionId, csId));
    if (!existing[0]) {
      await db.insert(schema.donationsTable).values({
        churchId: church.id,
        memberId: visitor.id,
        donorName: `Dev Visitor`,
        donorEmail: visitor.email,
        amountCents: 2500,
        donationDate: new Date(Date.now() - 14 * 24 * 3600_000),
        donationType: "one_time",
        givingCategory: "offering",
        campaignId: null,
        stripeCheckoutSessionId: csId,
        stripePaymentIntentId: `pi_test_dev_visitor_0`,
        paymentStatus: "succeeded",
        taxDeductible: true,
        receiptIssued: false,
      });
      donationCount++;
    }
  }

  // Inactive member old donation (edge case)
  if (inactiveMembers.length > 0) {
    const inactive = inactiveMembers[0];
    const csId = `cs_test_dev_inactive_old`;
    const existing = await db.select({ id: schema.donationsTable.id }).from(schema.donationsTable).where(eq(schema.donationsTable.stripeCheckoutSessionId, csId));
    if (!existing[0]) {
      await db.insert(schema.donationsTable).values({
        churchId: church.id,
        memberId: inactive.id,
        donorName: `Dev Inactive Member`,
        donorEmail: inactive.email,
        amountCents: 5000,
        donationDate: new Date("2025-06-15T12:00:00Z"),
        donationType: "one_time",
        givingCategory: "tithe",
        campaignId: null,
        stripeCheckoutSessionId: csId,
        stripePaymentIntentId: `pi_test_dev_inactive_old`,
        paymentStatus: "succeeded",
        taxDeductible: true,
        receiptIssued: true,
      });
      donationCount++;
    }
  }

  // 10 recurring plans
  for (let ri = 0; ri < recurringMembers.length; ri++) {
    const member = recurringMembers[ri];
    const subId = `sub_test_dev_${ri}_${member.id}`;
    const cusId = `cus_test_dev_${ri}_${member.id}`;
    const amountCents = recurringAmounts[ri];
    const status = ri === 8 ? "past_due" : "active"; // edge case: one past_due plan

    const existing = await db.select({ id: schema.recurringDonationsTable.id }).from(schema.recurringDonationsTable).where(eq(schema.recurringDonationsTable.stripeSubscriptionId, subId));
    if (!existing[0]) {
      await db.insert(schema.recurringDonationsTable).values({
        churchId: church.id,
        memberId: member.id,
        stripeSubscriptionId: subId,
        stripeCustomerId: cusId,
        amountCents,
        givingCategory: "tithe",
        campaignId: null,
        frequency: "monthly",
        status,
        startDate: new Date(Date.now() - (ri + 1) * 30 * 24 * 3600_000),
        nextPaymentDate: new Date(Date.now() + 15 * 24 * 3600_000),
      });

      // Corresponding donation record
      const csId2 = `cs_test_dev_recurring_${ri}_${member.id}`;
      const existingDon = await db.select({ id: schema.donationsTable.id }).from(schema.donationsTable).where(eq(schema.donationsTable.stripeCheckoutSessionId, csId2));
      if (!existingDon[0]) {
        await db.insert(schema.donationsTable).values({
          churchId: church.id,
          memberId: member.id,
          donorName: `Dev Recurring ${ri}`,
          donorEmail: member.email,
          amountCents,
          donationDate: new Date(Date.now() - 30 * 24 * 3600_000),
          donationType: "recurring",
          givingCategory: "tithe",
          campaignId: null,
          stripeCheckoutSessionId: csId2,
          stripeSubscriptionId: subId,
          stripeCustomerId: cusId,
          paymentStatus: status === "past_due" ? "failed" : "succeeded",
          taxDeductible: true,
          receiptIssued: false,
        });
        donationCount++;
      }

      recurringCount++;
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log("\n✅  Dev seed complete!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Church:              ${church.name}`);
  console.log(`  Total users:         ${allMembers.length + EXTRA_TEST_USERS.length}`);
  console.log(`  Generated members:   ${generatedUserIds.length}`);
  console.log(`  Test accounts:       ${EXTRA_TEST_USERS.length + 2} (admin@, member@, finance@, attendance@, children@)`);
  console.log(`  Attendance sessions: ${allCreatedSessions.length} (${sundaySessions.length} Sundays)`);
  console.log(`  Children:            ${createdChildren.length}`);
  console.log(`  Check-in records:    ${totalCheckins}`);
  console.log(`  Donations:           ${donationCount}`);
  console.log(`  Recurring plans:     ${recurringCount}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\nTest credentials:");
  console.log("  admin@churchos.test       (Admin123!)  — super admin");
  console.log("  finance@churchos.test     (Finance123!) — finance access");
  console.log("  attendance@churchos.test  (Attendance123!) — attendance access");
  console.log("  children@churchos.test    (Children123!) — children ministry");
  console.log("  member@churchos.test      (Member123!)  — member only");
  console.log("\n⚠️  These credentials only work in development mode (Clerk auth bypassed).");
}

seedDev()
  .then(() => pool.end())
  .catch((error) => {
    console.error("Seed failed:", error);
    void pool.end();
    process.exit(1);
  });
