/**
 * Dev-only seed script — generates realistic Admin Inbox test data.
 *
 * SAFETY: This script refuses to run in production.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run seed:inbox
 *
 * What it creates:
 *   - ~18 household_update_requests rows covering every request type
 *     (connect_form, account_request, prayer_request, meeting_request,
 *      family_change, child_link_update, pickup_authorization)
 *   - A mix of submitted (unread), reviewing (seen), completed, and declined
 *   - A mix of ages: today, yesterday, last week
 *   - Some linked to real seeded members, some to freshly created visitor stubs
 *
 * Idempotent: every request message is tagged with a "[DEV-TEST]" marker.
 * Re-running this script deletes all previously-tagged rows (and the visitor
 * stub users it created) before recreating them, so it's always safe to
 * run more than once.
 */

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to create inbox test data in production.");
  process.exit(1);
}

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { and, eq, inArray, like } from "drizzle-orm";
import * as schema from "@workspace/db";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const TEST_MARKER = "[DEV-TEST]";
const DEV_INBOX_EMAIL_DOMAIN = "@devtest-inbox.church";

function daysAgo(n: number, hour = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function seedInbox() {
  console.log("\nChurch OS — Admin Inbox Test Data Seed");
  console.log("========================================\n");

  const [church] = await db
    .select()
    .from(schema.churchesTable)
    .where(eq(schema.churchesTable.slug, "cjc-international"));

  if (!church) {
    console.error("Church 'cjc-international' not found. Run the base seed first:");
    console.error("    pnpm --filter @workspace/scripts run seed");
    process.exit(1);
  }
  console.log(`Church: ${church.name} (id=${church.id})`);

  // ── Cleanup previous test data ────────────────────────────────────────────
  await db
    .delete(schema.householdUpdateRequestsTable)
    .where(and(
      eq(schema.householdUpdateRequestsTable.churchId, church.id),
      like(schema.householdUpdateRequestsTable.message, `%${TEST_MARKER}%`),
    ));

  const priorStubUsers = await db
    .select({ id: schema.usersTable.id })
    .from(schema.usersTable)
    .where(and(
      eq(schema.usersTable.churchId, church.id),
      like(schema.usersTable.email, `%${DEV_INBOX_EMAIL_DOMAIN}`),
    ));

  if (priorStubUsers.length > 0) {
    await db
      .delete(schema.usersTable)
      .where(inArray(schema.usersTable.id, priorStubUsers.map((u) => u.id)));
  }
  console.log(`Cleared ${priorStubUsers.length} prior visitor stub(s) and their test requests.`);

  // ── Find a handful of real existing members to link some requests to ─────
  const realMembers = await db
    .select({ id: schema.usersTable.id, firstName: schema.usersTable.firstName, lastName: schema.usersTable.lastName, email: schema.usersTable.email })
    .from(schema.usersTable)
    .where(and(
      eq(schema.usersTable.churchId, church.id),
      eq(schema.usersTable.role, "member"),
      eq(schema.usersTable.memberStatus, "member"),
    ))
    .limit(10);

  if (realMembers.length < 4) {
    console.error("Not enough existing members found. Run the base seed (and ideally seed:dev) first:");
    console.error("    pnpm --filter @workspace/scripts run seed");
    console.error("    pnpm --filter @workspace/scripts run seed:dev");
    process.exit(1);
  }
  console.log(`Found ${realMembers.length} existing members to attach requests to.`);

  function member(i: number) {
    return realMembers[i % realMembers.length];
  }

  // ── Create visitor stub users for public/unlinked submissions ────────────
  type VisitorStub = { firstName: string; lastName: string; email: string; phoneNumber: string };
  const VISITOR_STUBS: VisitorStub[] = [
    { firstName: "Tyler", lastName: "Fake-Visitor", email: `tyler.firsttime${DEV_INBOX_EMAIL_DOMAIN}`, phoneNumber: "703-555-0101" },
    { firstName: "Priya", lastName: "Fake-Visitor", email: `priya.returning${DEV_INBOX_EMAIL_DOMAIN}`, phoneNumber: "703-555-0102" },
    { firstName: "Marcus", lastName: "Fake-Visitor", email: `marcus.prayer${DEV_INBOX_EMAIL_DOMAIN}`, phoneNumber: "703-555-0103" },
    { firstName: "Dana", lastName: "Fake-Visitor", email: `dana.membership${DEV_INBOX_EMAIL_DOMAIN}`, phoneNumber: "703-555-0104" },
    { firstName: "Omar", lastName: "Fake-Visitor", email: `omar.discipleship${DEV_INBOX_EMAIL_DOMAIN}`, phoneNumber: "703-555-0105" },
    { firstName: "Keisha", lastName: "Fake-Visitor", email: `keisha.contact${DEV_INBOX_EMAIL_DOMAIN}`, phoneNumber: "703-555-0106" },
    { firstName: "Test", lastName: "Fake-Duplicate", email: `dana.membership${DEV_INBOX_EMAIL_DOMAIN}`, phoneNumber: "703-555-0107" },
    { firstName: "Rosa", lastName: "Fake-Followup", email: `rosa.followup${DEV_INBOX_EMAIL_DOMAIN}`, phoneNumber: "703-555-0108" },
    { firstName: "Vincent", lastName: "Fake-Urgent", email: `vincent.urgent${DEV_INBOX_EMAIL_DOMAIN}`, phoneNumber: "703-555-0109" },
  ];

  const stubIds: Record<string, number> = {};
  for (const stub of VISITOR_STUBS) {
    if (stubIds[stub.email]) continue;
    const [created] = await db
      .insert(schema.usersTable)
      .values({
        churchId: church.id,
        firstName: stub.firstName,
        lastName: stub.lastName,
        email: stub.email,
        phoneNumber: stub.phoneNumber,
        memberStatus: "visitor",
        profileStatus: "pending_review",
        profileCompletionPercent: 20,
        role: "member",
        accountStatus: "pending",
        isActive: false,
      })
      .returning({ id: schema.usersTable.id });
    stubIds[stub.email] = created.id;
  }
  console.log(`Created ${Object.keys(stubIds).length} visitor stub user(s).`);

  function stub(email: string) {
    const id = stubIds[email];
    if (!id) throw new Error(`Missing stub user for ${email}`);
    return id;
  }

  function msg(lines: Array<string | null>): string {
    return [...lines.filter(Boolean), "", TEST_MARKER].join("\n");
  }

  type Row = {
    memberId: number;
    requestType: string;
    message: string;
    status: "submitted" | "reviewing" | "completed" | "declined";
    createdAt: Date;
    reviewedAt: Date | null;
  };

  const rows: Row[] = [
    // ── 1. Public Connect Form ──────────────────────────────────────────────
    {
      memberId: stub(`tyler.firsttime${DEV_INBOX_EMAIL_DOMAIN}`),
      requestType: "connect_form",
      message: msg(["Public Connect form submitted.", "", "First-time visitor: Yes", "Contact requested: Yes", "Preferred contact: text"]),
      status: "submitted",
      createdAt: daysAgo(0, 8),
      reviewedAt: null,
    },
    {
      memberId: stub(`priya.returning${DEV_INBOX_EMAIL_DOMAIN}`),
      requestType: "connect_form",
      message: msg(["Public Connect form submitted.", "", "First-time visitor: No", "Contact requested: No", "Preferred contact: email"]),
      status: "reviewing",
      createdAt: daysAgo(1, 10),
      reviewedAt: daysAgo(1, 11),
    },
    {
      memberId: stub(`marcus.prayer${DEV_INBOX_EMAIL_DOMAIN}`),
      requestType: "connect_form",
      message: msg(["Public Connect form submitted.", "", "First-time visitor: Yes", "Prayer request / message: Please pray for my mother's health.", "Contact requested: Yes"]),
      status: "submitted",
      createdAt: daysAgo(0, 14),
      reviewedAt: null,
    },
    {
      memberId: stub(`dana.membership${DEV_INBOX_EMAIL_DOMAIN}`),
      requestType: "connect_form",
      message: msg(["Public Connect form submitted.", "", "First-time visitor: No", "Interested in membership: Yes", "Ministry interest: Hospitality"]),
      status: "completed",
      createdAt: daysAgo(7, 9),
      reviewedAt: daysAgo(6, 15),
    },
    {
      memberId: stub(`omar.discipleship${DEV_INBOX_EMAIL_DOMAIN}`),
      requestType: "connect_form",
      message: msg(["Public Connect form submitted.", "", "First-time visitor: Yes", "Discipleship interest: Yes"]),
      status: "reviewing",
      createdAt: daysAgo(2, 13),
      reviewedAt: daysAgo(2, 16),
    },
    {
      memberId: stub(`keisha.contact${DEV_INBOX_EMAIL_DOMAIN}`),
      requestType: "connect_form",
      message: msg(["Public Connect form submitted.", "", "First-time visitor: No", "Contact requested: Yes", "Preferred contact: phone"]),
      status: "submitted",
      createdAt: daysAgo(0, 17),
      reviewedAt: null,
    },

    // ── 2. Request Member Account ───────────────────────────────────────────
    {
      memberId: member(0).id,
      requestType: "account_request",
      message: msg(["Member account access requested.", "", `Match status: Possible existing member match: ${member(0).firstName} ${member(0).lastName}`, "Preferred contact: email"]),
      status: "reviewing",
      createdAt: daysAgo(1, 9),
      reviewedAt: daysAgo(1, 12),
    },
    {
      memberId: stub(`vincent.urgent${DEV_INBOX_EMAIL_DOMAIN}`),
      requestType: "account_request",
      message: msg(["Member account access requested.", "", "Match status: No existing member match found", "Preferred contact: text", "Reason: New to the church, want to track giving and events."]),
      status: "submitted",
      createdAt: daysAgo(0, 10),
      reviewedAt: null,
    },
    {
      memberId: stub(`dana.membership${DEV_INBOX_EMAIL_DOMAIN}`),
      requestType: "account_request",
      message: msg(["Member account access requested.", "", "Match status: Possible existing member match: Dana Fake-Visitor", "Reason: Duplicate submission — already requested access last week, checking on status."]),
      status: "declined",
      createdAt: daysAgo(6, 11),
      reviewedAt: daysAgo(5, 9),
    },
    {
      memberId: stub(`rosa.followup${DEV_INBOX_EMAIL_DOMAIN}`),
      requestType: "account_request",
      message: msg(["Member account access requested.", "", "Match status: No existing member match found"]),
      status: "submitted",
      createdAt: daysAgo(0, 19),
      reviewedAt: null,
    },

    // ── 3. Prayer Request ────────────────────────────────────────────────────
    {
      memberId: member(1).id,
      requestType: "prayer_request",
      message: msg(["Prayer request: Please keep my family in prayer as we go through a difficult season with my father's diagnosis."]),
      status: "submitted",
      createdAt: daysAgo(0, 7),
      reviewedAt: null,
    },
    {
      memberId: stub(`marcus.prayer${DEV_INBOX_EMAIL_DOMAIN}`),
      requestType: "prayer_request",
      message: msg(["Prayer request: Traveling this week for a job interview, would appreciate prayer for safety and favor."]),
      status: "reviewing",
      createdAt: daysAgo(2, 8),
      reviewedAt: daysAgo(2, 9),
    },
    {
      memberId: member(2).id,
      requestType: "prayer_request",
      message: msg(["Prayer request: This is a sensitive family matter, please keep it confidential and only share with the pastoral team."]),
      status: "completed",
      createdAt: daysAgo(7, 10),
      reviewedAt: daysAgo(6, 8),
    },
    {
      memberId: member(3).id,
      requestType: "prayer_request",
      message: msg(["Prayer request: Going through a hard time and would also like to meet with a pastor to talk through it.", "", "Meeting requested: Yes"]),
      status: "submitted",
      createdAt: daysAgo(0, 20),
      reviewedAt: null,
    },

    // ── 4. Meeting Request ───────────────────────────────────────────────────
    {
      memberId: member(4).id,
      requestType: "meeting_request",
      message: msg(["Meeting request: Would like to schedule a pastoral counseling meeting sometime next week, evenings work best."]),
      status: "reviewing",
      createdAt: daysAgo(1, 15),
      reviewedAt: daysAgo(1, 16),
    },
    {
      memberId: stub(`rosa.followup${DEV_INBOX_EMAIL_DOMAIN}`),
      requestType: "meeting_request",
      message: msg(["Meeting request: I visited last Sunday and would like a follow-up meeting with someone from the church to learn more."]),
      status: "submitted",
      createdAt: daysAgo(0, 12),
      reviewedAt: null,
    },
    {
      memberId: stub(`vincent.urgent${DEV_INBOX_EMAIL_DOMAIN}`),
      requestType: "meeting_request",
      message: msg(["Meeting request: URGENT — need to speak with a pastor as soon as possible regarding a care emergency in my family."]),
      status: "submitted",
      createdAt: daysAgo(0, 21),
      reviewedAt: null,
    },

    // ── 5. Family / Household Change Request ────────────────────────────────
    {
      memberId: member(5).id,
      requestType: "family_change",
      message: msg([`Family request: Please link my spouse, ${member(6).firstName} ${member(6).lastName}, to my household record.`]),
      status: "submitted",
      createdAt: daysAgo(0, 9),
      reviewedAt: null,
    },
    {
      memberId: member(6).id,
      requestType: "family_change",
      message: msg([`Family request: My spouse and I have separated, please unlink ${member(5).firstName} ${member(5).lastName} from my household.`]),
      status: "reviewing",
      createdAt: daysAgo(2, 10),
      reviewedAt: daysAgo(2, 14),
    },
    {
      memberId: member(0).id,
      requestType: "family_change",
      message: msg(["Family request: Please add my daughter, Ava Smith (age 9), to my household as a linked child."]),
      status: "submitted",
      createdAt: daysAgo(0, 13),
      reviewedAt: null,
    },
    {
      memberId: member(1).id,
      requestType: "family_change",
      message: msg(["Family request: My son has moved in with his other parent full-time, please remove him from my household record."]),
      status: "completed",
      createdAt: daysAgo(7, 12),
      reviewedAt: daysAgo(6, 10),
    },
    {
      memberId: member(2).id,
      requestType: "pickup_authorization",
      message: msg(["Family request: Please add my sister as an authorized pickup person for children's ministry."]),
      status: "submitted",
      createdAt: daysAgo(1, 8),
      reviewedAt: null,
    },
    {
      memberId: member(3).id,
      requestType: "pickup_authorization",
      message: msg(["Family request: Remove my ex-spouse from the list of people authorized to pick up our children."]),
      status: "declined",
      createdAt: daysAgo(6, 14),
      reviewedAt: daysAgo(5, 11),
    },
    {
      memberId: member(4).id,
      requestType: "pickup_authorization",
      message: msg(["Family request: Please update our authorized pickup list — swap grandmother for our new nanny."]),
      status: "reviewing",
      createdAt: daysAgo(1, 16),
      reviewedAt: daysAgo(1, 17),
    },
    {
      memberId: member(7).id,
      requestType: "family_change",
      message: msg(["Family request: Please update my emergency contact information — no children involved."]),
      status: "submitted",
      createdAt: daysAgo(0, 18),
      reviewedAt: null,
    },
    {
      memberId: member(8).id,
      requestType: "family_change",
      message: msg(["Family request: Please link both of my children, Noah and Olivia, to my household record — they were recently added to the children's ministry roster."]),
      status: "submitted",
      createdAt: daysAgo(0, 22),
      reviewedAt: null,
    },

    // ── 6. Children Ministry / Pickup Request ───────────────────────────────
    {
      memberId: member(9).id,
      requestType: "pickup_authorization",
      message: msg(["Family request: Please add my mother-in-law, Helen Adams, as an authorized guardian for pickup — she'll be watching the kids on Wednesdays."]),
      status: "submitted",
      createdAt: daysAgo(0, 11),
      reviewedAt: null,
    },
    {
      memberId: member(5).id,
      requestType: "pickup_authorization",
      message: msg(["Family request: Please remove our former babysitter from the guardian/pickup list — no longer authorized."]),
      status: "reviewing",
      createdAt: daysAgo(2, 15),
      reviewedAt: daysAgo(2, 17),
    },
    {
      memberId: member(6).id,
      requestType: "pickup_authorization",
      message: msg(["Family request: Change pickup authorization so only parents (no extended family) can pick up our children until further notice."]),
      status: "submitted",
      createdAt: daysAgo(0, 15),
      reviewedAt: null,
    },
    {
      memberId: member(7).id,
      requestType: "pickup_authorization",
      message: msg(["Family request: Manually adding a guardian not in the member database — family friend Carla Jenkins, phone 703-555-0199 — for emergency pickup only."]),
      status: "completed",
      createdAt: daysAgo(7, 13),
      reviewedAt: daysAgo(6, 12),
    },
    {
      memberId: member(8).id,
      requestType: "pickup_authorization",
      message: msg([`Family request: Please add ${member(9).firstName} ${member(9).lastName} (existing member) as an authorized guardian for pickup — selected from the member database.`]),
      status: "submitted",
      createdAt: daysAgo(0, 16),
      reviewedAt: null,
    },
  ];

  for (const row of rows) {
    await db.insert(schema.householdUpdateRequestsTable).values({
      churchId: church.id,
      memberId: row.memberId,
      requestType: row.requestType,
      message: row.message,
      status: row.status,
      reviewedAt: row.reviewedAt,
      createdAt: row.createdAt,
      updatedAt: row.reviewedAt ?? row.createdAt,
    });
  }

  console.log(`\nInserted ${rows.length} test inbox requests.`);
  console.log("\nBreakdown by type:");
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.requestType] = (counts[row.requestType] ?? 0) + 1;
  for (const [type, count] of Object.entries(counts)) console.log(`  - ${type}: ${count}`);

  console.log("\nBreakdown by status:");
  const statusCounts: Record<string, number> = {};
  for (const row of rows) statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
  for (const [status, count] of Object.entries(statusCounts)) console.log(`  - ${status}: ${count}`);

  console.log("\nDone. Re-run this script anytime — it will clean up and recreate test data safely.\n");
}

seedInbox()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
