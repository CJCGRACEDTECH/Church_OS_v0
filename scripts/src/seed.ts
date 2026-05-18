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
  "attendance_management",
  "member_directory",
  "member_profiles",
  "event_management",
  "followup_notes",
  "pastoral_notes",
  "giving_summary",
  "giving_details",
  "giving_view_own",
  "giving_management",
  "giving_reports",
  "campaign_management",
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

const SAMPLE_MEMBERS = [
  {
    email: "morgan.johnson@example.test",
    firstName: "Morgan",
    lastName: "Johnson",
    preferredName: "Morgan",
    phoneNumber: "555-0100",
    dateOfBirth: "1987-03-08",
    gender: "Female",
    memberStatus: "active_member" as const,
    ministryDepartment: "Children Ministry",
    joinDate: "2021-09-12",
    baptismStatus: "baptized" as const,
    smallGroup: "Northside Cell",
    servingStatus: "serving" as const,
    streetAddress: "210 Grace Ave",
    city: "Springfield",
    state: "VA",
    zipCode: "22150",
    preferredContactMethod: "text" as const,
    emergencyContactName: "Taylor Friend",
    emergencyContactPhoneNumber: "555-0199",
    emergencyContactRelationship: "Friend",
  },
  {
    email: "riley.carter@example.test",
    firstName: "Riley",
    lastName: "Carter",
    preferredName: "Riley",
    phoneNumber: "555-0122",
    dateOfBirth: "1991-11-19",
    gender: "Male",
    memberStatus: "member" as const,
    ministryDepartment: "Hospitality",
    joinDate: "2023-01-22",
    baptismStatus: "unknown" as const,
    smallGroup: "Young Families",
    servingStatus: "interested" as const,
    streetAddress: "44 Covenant Ct",
    city: "Springfield",
    state: "VA",
    zipCode: "22152",
    preferredContactMethod: "phone" as const,
    emergencyContactName: "Dana Carter",
    emergencyContactPhoneNumber: "555-0188",
    emergencyContactRelationship: "Spouse",
  },
  {
    email: "jordan.williams@example.test",
    firstName: "Jordan",
    lastName: "Williams",
    preferredName: "",
    phoneNumber: "555-0144",
    dateOfBirth: "1984-07-27",
    gender: "Female",
    memberStatus: "visitor" as const,
    ministryDepartment: "Prayer",
    joinDate: null,
    baptismStatus: "not_baptized" as const,
    smallGroup: "",
    servingStatus: "not_serving" as const,
    streetAddress: "908 Mercy Lane",
    city: "Springfield",
    state: "VA",
    zipCode: "22153",
    preferredContactMethod: "email" as const,
    emergencyContactName: "Casey Williams",
    emergencyContactPhoneNumber: "555-0177",
    emergencyContactRelationship: "Spouse",
  },
];

const DEFAULT_EVENTS = [
  {
    title: "Tuesday Prayer / Bible Study",
    eventType: "bible_study" as const,
    description: "Weekly prayer and Bible study gathering on Zoom.",
    startDatetime: "2026-05-19T20:00:00",
    endDatetime: "2026-05-19T21:30:00",
    location: "Zoom",
    eventMode: "online" as const,
    zoomLink: "https://zoom.us/j/church-os-demo",
    youtubeLink: null,
    isRecurring: true,
    recurrencePattern: "weekly" as const,
    visibility: "public" as const,
    status: "published" as const,
  },
  {
    title: "Thursday Service",
    eventType: "service" as const,
    description: "Midweek worship service.",
    startDatetime: "2026-05-21T19:00:00",
    endDatetime: "2026-05-21T21:00:00",
    location: "Main Sanctuary",
    eventMode: "in_person" as const,
    zoomLink: null,
    youtubeLink: null,
    isRecurring: true,
    recurrencePattern: "weekly" as const,
    visibility: "public" as const,
    status: "published" as const,
  },
  {
    title: "Friday Service",
    eventType: "service" as const,
    description: "Friday evening worship and word.",
    startDatetime: "2026-05-22T19:00:00",
    endDatetime: "2026-05-22T21:00:00",
    location: "Main Sanctuary",
    eventMode: "hybrid" as const,
    zoomLink: null,
    youtubeLink: "https://youtube.com/@churchosdemo/live",
    isRecurring: true,
    recurrencePattern: "weekly" as const,
    visibility: "public" as const,
    status: "published" as const,
  },
  {
    title: "Saturday Service",
    eventType: "service" as const,
    description: "Saturday evening service.",
    startDatetime: "2026-05-23T19:00:00",
    endDatetime: "2026-05-23T21:00:00",
    location: "Main Sanctuary",
    eventMode: "in_person" as const,
    zoomLink: null,
    youtubeLink: null,
    isRecurring: true,
    recurrencePattern: "weekly" as const,
    visibility: "public" as const,
    status: "published" as const,
  },
  {
    title: "Sunday Service",
    eventType: "service" as const,
    description: "Sunday worship service.",
    startDatetime: "2026-05-24T11:00:00",
    endDatetime: "2026-05-24T13:00:00",
    location: "Main Sanctuary",
    eventMode: "hybrid" as const,
    zoomLink: null,
    youtubeLink: "https://youtube.com/@churchosdemo/live",
    isRecurring: true,
    recurrencePattern: "weekly" as const,
    visibility: "public" as const,
    status: "published" as const,
  },
  {
    title: "Water Baptism Sunday",
    eventType: "baptism" as const,
    description: "Baptism celebration after Sunday service.",
    startDatetime: "2026-06-07T13:30:00",
    endDatetime: "2026-06-07T14:30:00",
    location: "Main Sanctuary",
    eventMode: "in_person" as const,
    zoomLink: null,
    youtubeLink: null,
    posterUrl: "https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=900&q=80",
    isRecurring: false,
    recurrencePattern: "one_time" as const,
    visibility: "public" as const,
    status: "published" as const,
  },
  {
    title: "Fasting Season",
    eventType: "fasting_season" as const,
    description: "Church-wide fasting and prayer focus.",
    startDatetime: "2026-06-15T06:00:00",
    endDatetime: "2026-06-21T18:00:00",
    location: "Church-wide",
    eventMode: "hybrid" as const,
    zoomLink: "https://zoom.us/j/church-os-demo",
    youtubeLink: null,
    posterUrl: "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?auto=format&fit=crop&w=900&q=80",
    isRecurring: false,
    recurrencePattern: "one_time" as const,
    visibility: "public" as const,
    status: "published" as const,
  },
  {
    title: "Leadership Planning Draft",
    eventType: "special_event" as const,
    description: "Draft event used to verify members cannot see unpublished events.",
    startDatetime: "2026-06-10T19:00:00",
    endDatetime: "2026-06-10T20:00:00",
    location: "Conference Room",
    eventMode: "in_person" as const,
    zoomLink: null,
    youtubeLink: null,
    isRecurring: false,
    recurrencePattern: "one_time" as const,
    visibility: "admin_only" as const,
    status: "draft" as const,
  },
  {
    title: "Cancelled Outreach Briefing",
    eventType: "announcement" as const,
    description: "This event is cancelled and should show a cancelled badge.",
    startDatetime: "2026-06-12T18:00:00",
    endDatetime: "2026-06-12T19:00:00",
    location: "Fellowship Hall",
    eventMode: "in_person" as const,
    zoomLink: null,
    youtubeLink: null,
    isRecurring: false,
    recurrencePattern: "one_time" as const,
    visibility: "public" as const,
    status: "cancelled" as const,
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

const GIVING_CAMPAIGNS = [
  {
    campaignName: "Building Fund",
    description: "Support facility improvements and long-term ministry space needs.",
    goalAmountCents: 7500000,
    startDate: "2026-01-01T00:00:00Z",
    endDate: "2026-12-31T23:59:59Z",
    status: "active" as const,
    campaignImageUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80",
    campaignCategory: "Building Fund",
  },
  {
    campaignName: "Missions Trip",
    description: "Help fund travel, outreach materials, and local partner support for the next missions trip.",
    goalAmountCents: 1800000,
    startDate: "2026-03-01T00:00:00Z",
    endDate: "2026-08-31T23:59:59Z",
    status: "active" as const,
    campaignImageUrl: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80",
    campaignCategory: "Missions",
  },
];

const SAMPLE_DONATIONS = [
  {
    donorEmail: "member@churchos.test",
    donorName: "Church Member",
    amountCents: 15000,
    donationDate: "2026-01-12T15:30:00Z",
    donationType: "one_time" as const,
    givingCategory: "tithe" as const,
    campaignName: null,
    stripeCheckoutSessionId: "cs_demo_member_tithe_jan",
    stripePaymentIntentId: "pi_demo_member_tithe_jan",
    stripeReceiptUrl: "https://pay.stripe.com/receipts/demo-member-tithe-jan",
    paymentStatus: "succeeded" as const,
    taxDeductible: true,
  },
  {
    donorEmail: "member@churchos.test",
    donorName: "Church Member",
    amountCents: 5000,
    donationDate: "2026-02-09T16:00:00Z",
    donationType: "recurring" as const,
    givingCategory: "missions" as const,
    campaignName: "Missions Trip",
    stripeCheckoutSessionId: "cs_demo_member_missions_recurring",
    stripePaymentIntentId: "pi_demo_member_missions_recurring",
    stripeSubscriptionId: "sub_demo_member_missions",
    stripeReceiptUrl: "https://pay.stripe.com/receipts/demo-member-missions",
    paymentStatus: "succeeded" as const,
    taxDeductible: true,
  },
  {
    donorEmail: "morgan.johnson@example.test",
    donorName: "Morgan Johnson",
    amountCents: 25000,
    donationDate: "2026-03-16T14:15:00Z",
    donationType: "one_time" as const,
    givingCategory: "building_fund" as const,
    campaignName: "Building Fund",
    stripeCheckoutSessionId: "cs_demo_morgan_building",
    stripePaymentIntentId: "pi_demo_morgan_building",
    stripeReceiptUrl: "https://pay.stripe.com/receipts/demo-morgan-building",
    paymentStatus: "succeeded" as const,
    taxDeductible: true,
  },
  {
    donorEmail: "riley.carter@example.test",
    donorName: "Riley Carter",
    amountCents: 7500,
    donationDate: "2026-04-07T18:45:00Z",
    donationType: "one_time" as const,
    givingCategory: "offering" as const,
    campaignName: null,
    stripeCheckoutSessionId: "cs_demo_riley_failed",
    stripePaymentIntentId: "pi_demo_riley_failed",
    stripeReceiptUrl: null,
    paymentStatus: "failed" as const,
    taxDeductible: true,
  },
];

async function seed() {
  const isReset = process.argv.includes("--reset");

  if (isReset) {
    console.log("🗑️  Resetting users and churches...");
    await db.delete(schema.checkinRecordsTable);
    await db.delete(schema.attendanceRecordsTable);
    await db.delete(schema.attendanceSessionsTable);
    await db.delete(schema.taxReceiptsTable);
    await db.delete(schema.recurringDonationsTable);
    await db.delete(schema.donationsTable);
    await db.delete(schema.givingCampaignsTable);
    await db.delete(schema.systemSettingsTable);
    await db.delete(schema.churchProfileSettingsTable);
    await db.delete(schema.childGuardianRelationshipsTable);
    await db.delete(schema.parentGuardiansTable);
    await db.delete(schema.childrenTable);
    await db.delete(schema.eventsTable);
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

  console.log("🌱 Seeding member directory sample data...");
  for (const memberInput of SAMPLE_MEMBERS) {
    const [member] = await db
      .insert(schema.usersTable)
      .values({
        ...memberInput,
        preferredName: memberInput.preferredName || null,
        joinDate: memberInput.joinDate,
        smallGroup: memberInput.smallGroup || null,
        churchId: church.id,
        role: "member",
        adminLevel: null,
        assignedMinistry: null,
        accountStatus: "active",
        isActive: true,
      })
      .onConflictDoUpdate({
        target: schema.usersTable.email,
        set: {
          firstName: memberInput.firstName,
          lastName: memberInput.lastName,
          preferredName: memberInput.preferredName || null,
          phoneNumber: memberInput.phoneNumber,
          dateOfBirth: memberInput.dateOfBirth,
          gender: memberInput.gender,
          memberStatus: memberInput.memberStatus,
          ministryDepartment: memberInput.ministryDepartment,
          joinDate: memberInput.joinDate,
          baptismStatus: memberInput.baptismStatus,
          smallGroup: memberInput.smallGroup || null,
          servingStatus: memberInput.servingStatus,
          streetAddress: memberInput.streetAddress,
          city: memberInput.city,
          state: memberInput.state,
          zipCode: memberInput.zipCode,
          preferredContactMethod: memberInput.preferredContactMethod,
          emergencyContactName: memberInput.emergencyContactName,
          emergencyContactPhoneNumber: memberInput.emergencyContactPhoneNumber,
          emergencyContactRelationship: memberInput.emergencyContactRelationship,
          role: "member",
          accountStatus: "active",
          isActive: true,
        },
      })
      .returning();

    console.log(`   member: ${member.firstName} ${member.lastName} (${member.email})`);
  }

  console.log("🌱 Seeding Services & Events...");
  const [eventCreator] = await db
    .select({ id: schema.usersTable.id })
    .from(schema.usersTable)
    .where(eq(schema.usersTable.email, "admin@churchos.test"));

  for (const eventInput of DEFAULT_EVENTS) {
    const startDatetime = new Date(eventInput.startDatetime);
    const endDatetime = new Date(eventInput.endDatetime);
    const [existingEvent] = await db
      .select({ id: schema.eventsTable.id })
      .from(schema.eventsTable)
      .where(and(eq(schema.eventsTable.churchId, church.id), eq(schema.eventsTable.title, eventInput.title)));

    const values = {
      ...eventInput,
      churchId: church.id,
      startDatetime,
      endDatetime,
      recurrenceDay: eventInput.isRecurring ? startDatetime.getDay() : null,
      recurrenceTime: eventInput.isRecurring
        ? `${String(startDatetime.getHours()).padStart(2, "0")}:${String(startDatetime.getMinutes()).padStart(2, "0")}`
        : null,
      posterUrl: "posterUrl" in eventInput ? eventInput.posterUrl : null,
      createdByUserId: eventCreator?.id ?? null,
    };

    const [event] = existingEvent
      ? await db.update(schema.eventsTable).set(values).where(eq(schema.eventsTable.id, existingEvent.id)).returning()
      : await db.insert(schema.eventsTable).values(values).returning();

    console.log(`   event: ${event.title} (${event.status})`);
  }

  console.log("🌱 Seeding Giving sample data...");
  const [givingCreator] = await db
    .select({ id: schema.usersTable.id })
    .from(schema.usersTable)
    .where(eq(schema.usersTable.email, "admin@churchos.test"));

  const campaignIds = new Map<string, number>();
  for (const campaignInput of GIVING_CAMPAIGNS) {
    const [existingCampaign] = await db
      .select()
      .from(schema.givingCampaignsTable)
      .where(eq(schema.givingCampaignsTable.campaignName, campaignInput.campaignName));

    const values = {
      ...campaignInput,
      startDate: new Date(campaignInput.startDate),
      endDate: new Date(campaignInput.endDate),
      createdByUserId: givingCreator?.id ?? null,
    };

    const [campaign] = existingCampaign
      ? await db.update(schema.givingCampaignsTable).set(values).where(eq(schema.givingCampaignsTable.id, existingCampaign.id)).returning()
      : await db.insert(schema.givingCampaignsTable).values(values).returning();

    campaignIds.set(campaign.campaignName, campaign.id);
    console.log(`   campaign: ${campaign.campaignName} (${campaign.status})`);
  }

  for (const donationInput of SAMPLE_DONATIONS) {
    const [donor] = await db
      .select()
      .from(schema.usersTable)
      .where(eq(schema.usersTable.email, donationInput.donorEmail));

    if (!donor) continue;

    const [existingDonation] = await db
      .select()
      .from(schema.donationsTable)
      .where(eq(schema.donationsTable.stripeCheckoutSessionId, donationInput.stripeCheckoutSessionId));

    const campaignId = donationInput.campaignName ? campaignIds.get(donationInput.campaignName) ?? null : null;
    const values = {
      memberId: donor.id,
      donorName: donationInput.donorName,
      donorEmail: donationInput.donorEmail,
      amountCents: donationInput.amountCents,
      donationDate: new Date(donationInput.donationDate),
      donationType: donationInput.donationType,
      givingCategory: donationInput.givingCategory,
      campaignId,
      stripeCheckoutSessionId: donationInput.stripeCheckoutSessionId,
      stripePaymentIntentId: donationInput.stripePaymentIntentId,
      stripeSubscriptionId: "stripeSubscriptionId" in donationInput ? donationInput.stripeSubscriptionId : null,
      stripeReceiptUrl: donationInput.stripeReceiptUrl,
      paymentStatus: donationInput.paymentStatus,
      taxDeductible: donationInput.taxDeductible,
    };

    const [donation] = existingDonation
      ? await db.update(schema.donationsTable).set(values).where(eq(schema.donationsTable.id, existingDonation.id)).returning()
      : await db.insert(schema.donationsTable).values(values).returning();

    if (donation.donationType === "recurring") {
      const [existingRecurring] = await db
        .select()
        .from(schema.recurringDonationsTable)
        .where(eq(schema.recurringDonationsTable.stripeSubscriptionId, donation.stripeSubscriptionId ?? ""));

      const recurringValues = {
        memberId: donor.id,
        stripeSubscriptionId: donation.stripeSubscriptionId,
        stripeCustomerId: "cus_demo_member",
        amountCents: donation.amountCents,
        givingCategory: donation.givingCategory,
        campaignId,
        frequency: "monthly" as const,
        status: "active" as const,
        startDate: donation.donationDate,
        nextPaymentDate: new Date("2026-06-09T16:00:00Z"),
      };

      if (existingRecurring) {
        await db.update(schema.recurringDonationsTable).set(recurringValues).where(eq(schema.recurringDonationsTable.id, existingRecurring.id));
      } else {
        await db.insert(schema.recurringDonationsTable).values(recurringValues);
      }
    }

    console.log(`   donation: ${donation.donorName} ${donation.givingCategory} ${donation.paymentStatus}`);
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
