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
 *   ─── Test accounts ─────────────────────────────────────────────────────────
 *   - 7 named test users: superadmin@, admin1@–admin5@, member@
 *
 *   ─── Members ───────────────────────────────────────────────────────────────
 *   - 45 household groups (families, couples, seniors, singles, shared homes)
 *   - 165 user/member/admin rows plus 35 children = 200 total fake people
 *
 *   ─── Children ──────────────────────────────────────────────────────────────
 *   - 35 children ages 2–12 in the children table
 *   - Each linked to 1–2 guardians (matching household parent names/emails)
 *   - Classroom assignment: Toddlers (2–3), Preschool (4–5), Elementary (6–12)
 *
 *   ─── Attendance ────────────────────────────────────────────────────────────
 *   - 48 regular service sessions (4 services × 12 weeks)
 *   - 12 discipleship sessions using the same attendance system
 *   - Thousands of attendance records with realistic patterns per day-of-week
 *
 *   ─── Check-in ──────────────────────────────────────────────────────────────
 *   - Sunday sessions only, 18–30 children per Sunday, 12 Sundays
 *   - Includes unresolved checkout and historical duplicate QA edge cases
 *
 *   ─── Giving ────────────────────────────────────────────────────────────────
 *   - 2 giving campaigns
 *   - 150–300 donations across 60+ donors
 *   - 25 recurring plans (monthly tithe)
 *   - Fake Stripe IDs (no real API calls)
 *
 *   ─── Edge cases ────────────────────────────────────────────────────────────
 *   - Member with no DOB
 *   - Visitor with minimal contact info
 *   - Member with old attendance history but little/no recent attendance
 *   - Child missing checkout (unresolved active check-in)
 *   - Child linked to one parent only (single-parent household)
 *   - Household with secondary guardian / emergency contact
 *   - All donations use succeeded payment status only
 *   - Recurring tithe plans use active subscription status only
 *   - Member with no household assignment
 *   - Household with no children (married couple without kids)
 */

if (process.env.NODE_ENV === "production") {
  console.error("❌  Refusing to seed dev data in production.");
  process.exit(1);
}

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { and, eq, like } from "drizzle-orm";
import * as schema from "@workspace/db";
import bcrypt from "bcryptjs";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const DEV_EMAIL_DOMAIN = "@devtest.church";
const isReset = process.argv.includes("--reset");

// ─── Type helpers ─────────────────────────────────────────────────────────────
type MemberStatus = "member" | "visitor";
type AccountStatus = "active" | "pending" | "disabled";
type AdminLevel = "super_admin" | null;
type Role = "admin" | "member";

// ─── Data pools ───────────────────────────────────────────────────────────────
const FIRST_M = ["James", "Michael", "David", "Robert", "John", "William", "Christopher", "Matthew", "Daniel", "Anthony", "Mark", "Steven", "Paul", "Andrew", "Kevin", "Brian", "George", "Eric", "Timothy", "Joshua"];
const FIRST_F = ["Mary", "Patricia", "Jennifer", "Linda", "Barbara", "Susan", "Dorothy", "Karen", "Lisa", "Nancy", "Betty", "Margaret", "Sandra", "Ashley", "Emily", "Jessica", "Amanda", "Stephanie", "Melissa", "Rebecca"];
const EXTRA_LAST = ["Washington", "Adams", "Jefferson", "Hamilton", "Franklin", "Lincoln", "Grant", "Hayes", "Pierce", "Garfield", "Arthur", "Cleveland", "Harrison", "McKinley", "Roosevelt", "Taft", "Wilson", "Harding", "Coolidge", "Hoover"];
const MINISTRIES = ["Worship Team", "Children Ministry", "Hospitality", "Prayer Team", "Youth Ministry", "Outreach", "Media & Tech", "Ushers", "Small Groups", "Discipleship"];
const SMALL_GROUPS = ["Young Adults", "Young Families", "Northside Cell", "Eastgate Group", "Men's Fellowship", "Women's Circle", "Marriage Ministry", "Senior Saints", "College Group", "Spanish Ministry"];
const OCCUPATIONS = ["Teacher", "Nurse", "Engineer", "Pastor", "Accountant", "Social Worker", "Doctor", "Business Owner", "IT Specialist", "Retail Manager", "Construction Worker", "Administrative Assistant", "Counselor", "Police Officer", "Firefighter"];
const CLASSROOMS = ["Toddlers", "Preschool", "Elementary"] as const;
const ALLERGY_POOL = [null, null, null, "Peanuts", "Dairy sensitivity", "Tree nuts", "Gluten-free diet", null, null, "Latex allergy"];
const MEDICAL_POOL = [null, null, null, null, "Inhaler in backpack", "Epipen required", null, null, null, null];
const SUPPLEMENTAL_LAST = ["Bennett", "Carter", "Coleman", "Cooper", "Edwards", "Foster", "Gray", "Green", "Howard", "King", "Morris", "Nelson", "Parker", "Reed", "Simmons", "Stewart", "Turner", "Ward", "Watson", "Wright"];
const SUPPLEMENTAL_CHILDREN = ["Aria", "Josiah", "Layla", "Micah", "Nora", "Isaac", "Maya", "Levi", "Naomi", "Ezra", "Lena", "Malachi", "Sienna"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pick<T>(arr: T[], i: number): T {
  return arr[Math.abs(i) % arr.length];
}

function shuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.abs((seed * (i + 1) * 1103515245 + 12345) % (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function seededInt(seed: number, min: number, max: number): number {
  return min + Math.abs(seed * 1103515245 + 12345) % (max - min + 1);
}

function pastDayOccurrences(dayOfWeek: number, count: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates: Date[] = [];
  const current = new Date(today);
  current.setDate(current.getDate() - 1);
  while (dates.length < count) {
    if (current.getDay() === dayOfWeek) dates.push(new Date(current));
    current.setDate(current.getDate() - 1);
  }
  return dates;
}

function makeQrToken(suffix: string): string {
  return `qr_dev_${Date.now()}_${suffix.replace(/\s/g, "_")}`;
}

function makePickupCode(seed = 0): string {
  return String(1000 + Math.abs(seededInt(seed + 31, 0, 8999)));
}

function dobFromAge(ageYears: number, offsetDays = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - ageYears);
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ".");
}

function accountStatusFor(ms: MemberStatus): AccountStatus {
  if (ms === "visitor") return "pending";
  return "active";
}

function householdAddress(index: number) {
  return {
    streetAddress: `${3000 + index * 4} Fellowship Court`,
    city: pick(["Springfield", "Fairview", "Riverside", "Oakwood", "Maplewood"], index),
    state: pick(["VA", "MD", "DC", "PA", "NC"], index),
    zip: String(22000 + index * 13).padStart(5, "0").slice(0, 5),
  };
}

// ─── Test accounts ────────────────────────────────────────────────────────────
const EXTRA_TEST_USERS: Array<{
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: Role;
  adminLevel: AdminLevel;
  accountStatus: AccountStatus;
  memberStatus: MemberStatus;
  assignedMinistry: string;
  permissions: string[];
}> = [
  {
    email: "superadmin@churchos.test",
    password: "SuperAdmin123!",
    firstName: "Super",
    lastName: "Admin",
    role: "admin",
    adminLevel: "super_admin",
    accountStatus: "active",
    memberStatus: "member",
    assignedMinistry: "Executive Leadership",
    permissions: [
      "attendance_checkin", "attendance_management", "member_directory", "member_profiles",
      "event_management", "followup_notes", "pastoral_notes", "giving_summary",
      "giving_details", "giving_view_own", "giving_management", "giving_reports",
      "campaign_management", "reports", "admin_management", "system_settings",
    ],
  },
  ...[1, 2, 3, 4, 5].map((n) => ({
    email: `admin${n}@churchos.test`,
    password: "Admin123!",
    firstName: "Admin",
    lastName: String(n),
    role: "admin" as Role,
    adminLevel: null,
    accountStatus: "active" as AccountStatus,
    memberStatus: "member" as MemberStatus,
    assignedMinistry: ["Operations", "Children Ministry", "Giving", "Member Care", "Services"][n - 1],
    permissions: [
      ["attendance_checkin", "attendance_management", "member_directory", "member_profiles", "event_management"],
      ["attendance_checkin", "member_directory", "member_profiles"],
      ["giving_summary", "giving_details", "giving_view_own", "giving_management", "giving_reports", "campaign_management"],
      ["member_directory", "member_profiles", "followup_notes"],
      ["event_management", "attendance_management", "member_directory"],
    ][n - 1],
  })),
  {
    email: "member@churchos.test",
    password: "Member123!",
    firstName: "Church",
    lastName: "Member",
    role: "member",
    adminLevel: null,
    accountStatus: "active",
    memberStatus: "member",
    assignedMinistry: "Hospitality",
    permissions: [],
  },
];

// ─── Household blueprints ─────────────────────────────────────────────────────
//
// Base household blueprints plus supplemental groups create 45 households.
// Children are in the `children` table and linked through parentGuardiansTable.
// Spouse pairs share last name, address, and maritalStatus="married".
//
// No DB households table exists — households are modeled as shared address +
// last name + maritalStatus. The member portal reads child-guardian links.

interface HouseholdMemberDef {
  firstName: string;
  gender: "Male" | "Female";
  ageYears: number;
  maritalStatus: "married" | "single" | "widowed" | "divorced" | null;
  memberStatus: MemberStatus;
  occupation?: string;
  ministry?: string;
  smallGroup?: string;
}

interface HouseholdChildDef {
  firstName: string;
  gender: "Male" | "Female";
  ageYears: number;
  hasSecondGuardian?: boolean;
  secondGuardianIsEmergencyOnly?: boolean;
}

interface HouseholdBlueprint {
  label: string;
  lastName: string;
  streetAddress: string;
  city: string;
  state: string;
  zip: string;
  members: HouseholdMemberDef[];
  children?: HouseholdChildDef[];
  note?: string;
}

const HOUSEHOLDS: HouseholdBlueprint[] = [
  // ── Married couples with children ────────────────────────────────────────
  {
    label: "Smith family",
    lastName: "Smith",
    streetAddress: "101 Oak Avenue",
    city: "Springfield",
    state: "VA",
    zip: "22150",
    members: [
      { firstName: "Thomas", gender: "Male", ageYears: 42, maritalStatus: "married", memberStatus: "member", ministry: "Worship Team", smallGroup: "Marriage Ministry" },
      { firstName: "Grace", gender: "Female", ageYears: 39, maritalStatus: "married", memberStatus: "member", occupation: "Teacher", smallGroup: "Marriage Ministry" },
    ],
    children: [
      { firstName: "Ava", gender: "Female", ageYears: 9, hasSecondGuardian: true },
      { firstName: "Ethan", gender: "Male", ageYears: 6, hasSecondGuardian: true },
    ],
  },
  {
    label: "Johnson family",
    lastName: "Johnson",
    streetAddress: "204 Maple Street",
    city: "Fairview",
    state: "MD",
    zip: "20833",
    members: [
      { firstName: "Marcus", gender: "Male", ageYears: 36, maritalStatus: "married", memberStatus: "member", occupation: "Engineer" },
      { firstName: "Diane", gender: "Female", ageYears: 34, maritalStatus: "married", memberStatus: "member", ministry: "Hospitality", smallGroup: "Young Families" },
    ],
    children: [
      { firstName: "Noah", gender: "Male", ageYears: 8, hasSecondGuardian: true },
      { firstName: "Olivia", gender: "Female", ageYears: 5, hasSecondGuardian: true },
    ],
  },
  {
    label: "Williams family",
    lastName: "Williams",
    streetAddress: "318 Pine Road",
    city: "Riverside",
    state: "DC",
    zip: "20001",
    members: [
      { firstName: "Derek", gender: "Male", ageYears: 44, maritalStatus: "married", memberStatus: "member", ministry: "Ushers" },
      { firstName: "Carol", gender: "Female", ageYears: 41, maritalStatus: "married", memberStatus: "member", occupation: "Nurse", smallGroup: "Young Families" },
    ],
    children: [
      { firstName: "Sophia", gender: "Female", ageYears: 12, hasSecondGuardian: true },
      { firstName: "Mason", gender: "Male", ageYears: 10, hasSecondGuardian: true },
    ],
  },
  {
    label: "Brown family",
    lastName: "Brown",
    streetAddress: "422 Cedar Lane",
    city: "Oakwood",
    state: "PA",
    zip: "19101",
    members: [
      { firstName: "Kevin", gender: "Male", ageYears: 31, maritalStatus: "married", memberStatus: "member", occupation: "IT Specialist" },
      { firstName: "Angela", gender: "Female", ageYears: 29, maritalStatus: "married", memberStatus: "member", smallGroup: "Young Families" },
    ],
    children: [
      { firstName: "Liam", gender: "Male", ageYears: 3, hasSecondGuardian: true },
    ],
  },
  {
    label: "Jones family",
    lastName: "Jones",
    streetAddress: "516 Birch Boulevard",
    city: "Maplewood",
    state: "NC",
    zip: "28201",
    members: [
      { firstName: "Anthony", gender: "Male", ageYears: 47, maritalStatus: "married", memberStatus: "member", occupation: "Business Owner", ministry: "Small Groups" },
      { firstName: "Sandra", gender: "Female", ageYears: 45, maritalStatus: "married", memberStatus: "member", ministry: "Prayer Team", smallGroup: "Marriage Ministry" },
    ],
    children: [
      { firstName: "Emma", gender: "Female", ageYears: 11, hasSecondGuardian: true },
      { firstName: "Logan", gender: "Male", ageYears: 7, hasSecondGuardian: true },
    ],
  },
  {
    label: "Garcia family",
    lastName: "Garcia",
    streetAddress: "618 Elm Street",
    city: "Springfield",
    state: "VA",
    zip: "22151",
    members: [
      { firstName: "Carlos", gender: "Male", ageYears: 38, maritalStatus: "married", memberStatus: "member", ministry: "Media & Tech" },
      { firstName: "Maria", gender: "Female", ageYears: 35, maritalStatus: "married", memberStatus: "member", occupation: "Social Worker", smallGroup: "Young Families" },
    ],
    children: [
      { firstName: "Isabella", gender: "Female", ageYears: 4, hasSecondGuardian: true },
    ],
  },
  {
    label: "Miller family",
    lastName: "Miller",
    streetAddress: "720 Willow Way",
    city: "Fairview",
    state: "MD",
    zip: "20834",
    members: [
      { firstName: "Brian", gender: "Male", ageYears: 40, maritalStatus: "married", memberStatus: "member", occupation: "Police Officer" },
      { firstName: "Tamara", gender: "Female", ageYears: 38, maritalStatus: "married", memberStatus: "member", ministry: "Children Ministry" },
    ],
    children: [
      { firstName: "Charlotte", gender: "Female", ageYears: 6, hasSecondGuardian: true },
      { firstName: "Oliver", gender: "Male", ageYears: 2, hasSecondGuardian: true },
    ],
    note: "edge: one child is a toddler",
  },
  {
    label: "Davis family — no children",
    lastName: "Davis",
    streetAddress: "824 Spruce Court",
    city: "Riverside",
    state: "DC",
    zip: "20002",
    members: [
      { firstName: "Raymond", gender: "Male", ageYears: 52, maritalStatus: "married", memberStatus: "member", ministry: "Discipleship" },
      { firstName: "Evelyn", gender: "Female", ageYears: 49, maritalStatus: "married", memberStatus: "member", occupation: "Accountant" },
    ],
    note: "edge: household with no children",
  },
  {
    label: "Rodriguez family",
    lastName: "Rodriguez",
    streetAddress: "928 Poplar Place",
    city: "Oakwood",
    state: "PA",
    zip: "19102",
    members: [
      { firstName: "Miguel", gender: "Male", ageYears: 33, maritalStatus: "married", memberStatus: "member" },
      { firstName: "Luisa", gender: "Female", ageYears: 31, maritalStatus: "married", memberStatus: "member", smallGroup: "Spanish Ministry" },
    ],
    children: [
      { firstName: "Amelia", gender: "Female", ageYears: 5, hasSecondGuardian: true },
      { firstName: "Benjamin", gender: "Male", ageYears: 7, hasSecondGuardian: true },
    ],
  },
  {
    label: "Martinez family",
    lastName: "Martinez",
    streetAddress: "1030 Magnolia Drive",
    city: "Maplewood",
    state: "NC",
    zip: "28202",
    members: [
      { firstName: "Jose", gender: "Male", ageYears: 55, maritalStatus: "married", memberStatus: "member", occupation: "Construction Worker" },
      { firstName: "Rosa", gender: "Female", ageYears: 51, maritalStatus: "married", memberStatus: "member", smallGroup: "Marriage Ministry" },
    ],
    children: [
      { firstName: "Harper", gender: "Female", ageYears: 10, hasSecondGuardian: true },
    ],
  },
  {
    label: "Anderson family",
    lastName: "Anderson",
    streetAddress: "1134 Chestnut Circle",
    city: "Springfield",
    state: "VA",
    zip: "22152",
    members: [
      { firstName: "Gregory", gender: "Male", ageYears: 43, maritalStatus: "married", memberStatus: "member", ministry: "Outreach" },
      { firstName: "Vanessa", gender: "Female", ageYears: 40, maritalStatus: "married", memberStatus: "member", occupation: "Counselor" },
    ],
    children: [
      { firstName: "Elijah", gender: "Male", ageYears: 8, hasSecondGuardian: true },
      { firstName: "Mia", gender: "Female", ageYears: 11, hasSecondGuardian: true },
    ],
  },
  {
    label: "Taylor family — no children",
    lastName: "Taylor",
    streetAddress: "1238 Hickory Path",
    city: "Fairview",
    state: "MD",
    zip: "20835",
    members: [
      { firstName: "Scott", gender: "Male", ageYears: 28, maritalStatus: "married", memberStatus: "member", smallGroup: "Young Adults" },
      { firstName: "Lauren", gender: "Female", ageYears: 27, maritalStatus: "married", memberStatus: "member", smallGroup: "Young Adults" },
    ],
    note: "edge: newly married, no children yet; new member status",
  },
  // ── Single-parent households ──────────────────────────────────────────────
  {
    label: "Wilson — single mother",
    lastName: "Wilson",
    streetAddress: "1342 Walnut Way",
    city: "Riverside",
    state: "DC",
    zip: "20003",
    members: [
      { firstName: "Natasha", gender: "Female", ageYears: 32, maritalStatus: "divorced", memberStatus: "member", occupation: "Administrative Assistant", ministry: "Hospitality" },
    ],
    children: [
      { firstName: "Lucas", gender: "Male", ageYears: 9, hasSecondGuardian: false },
      { firstName: "Zoe", gender: "Female", ageYears: 5, hasSecondGuardian: false },
    ],
    note: "edge: single parent, children linked to one guardian only",
  },
  {
    label: "Thomas — single father",
    lastName: "Thomas",
    streetAddress: "1446 Sycamore Street",
    city: "Oakwood",
    state: "PA",
    zip: "19103",
    members: [
      { firstName: "Jerome", gender: "Male", ageYears: 37, maritalStatus: "divorced", memberStatus: "member", ministry: "Youth Ministry" },
    ],
    children: [
      { firstName: "Aiden", gender: "Male", ageYears: 6, hasSecondGuardian: false },
    ],
    note: "edge: single parent, child linked to one guardian only",
  },
  {
    label: "Moore — widowed parent",
    lastName: "Moore",
    streetAddress: "1550 Redwood Road",
    city: "Maplewood",
    state: "NC",
    zip: "28203",
    members: [
      { firstName: "Gloria", gender: "Female", ageYears: 49, maritalStatus: "widowed", memberStatus: "member", occupation: "Teacher", ministry: "Prayer Team" },
    ],
    children: [
      { firstName: "Caleb", gender: "Male", ageYears: 12, hasSecondGuardian: true, secondGuardianIsEmergencyOnly: true },
    ],
    note: "edge: widowed parent; second contact is aunt (emergency_contact only)",
  },
  // ── Single adult households ────────────────────────────────────────────────
  {
    label: "Lee — single adult",
    lastName: "Lee",
    streetAddress: "1654 Ash Avenue",
    city: "Springfield",
    state: "VA",
    zip: "22153",
    members: [
      { firstName: "Daniel", gender: "Male", ageYears: 24, maritalStatus: "single", memberStatus: "member", smallGroup: "Young Adults", occupation: "IT Specialist" },
    ],
  },
  {
    label: "White — single adult",
    lastName: "White",
    streetAddress: "1758 Fir Lane",
    city: "Fairview",
    state: "MD",
    zip: "20836",
    members: [
      { firstName: "Brittany", gender: "Female", ageYears: 26, maritalStatus: "single", memberStatus: "member", smallGroup: "Young Adults" },
    ],
  },
  {
    label: "Harris — single adult",
    lastName: "Harris",
    streetAddress: "1862 Larch Loop",
    city: "Riverside",
    state: "DC",
    zip: "20004",
    members: [
      { firstName: "Damien", gender: "Male", ageYears: 29, maritalStatus: "single", memberStatus: "member", ministry: "Media & Tech" },
    ],
  },
  {
    label: "Clark — single adult",
    lastName: "Clark",
    streetAddress: "1966 Cottonwood Court",
    city: "Oakwood",
    state: "PA",
    zip: "19104",
    members: [
      { firstName: "Tiffany", gender: "Female", ageYears: 23, maritalStatus: "single", memberStatus: "member", smallGroup: "Young Adults" },
    ],
    note: "edge: new member, no ministry yet",
  },
  {
    label: "Lewis — single adult",
    lastName: "Lewis",
    streetAddress: "2070 Sequoia Street",
    city: "Maplewood",
    state: "NC",
    zip: "28204",
    members: [
      { firstName: "Marcus", gender: "Male", ageYears: 31, maritalStatus: "single", memberStatus: "member", smallGroup: "Men's Fellowship" },
    ],
  },
  // ── Senior households ──────────────────────────────────────────────────────
  {
    label: "Robinson — senior couple",
    lastName: "Robinson",
    streetAddress: "2174 Golden Oak Drive",
    city: "Springfield",
    state: "VA",
    zip: "22154",
    members: [
      { firstName: "Robert", gender: "Male", ageYears: 71, maritalStatus: "married", memberStatus: "member", smallGroup: "Senior Saints" },
      { firstName: "Margaret", gender: "Female", ageYears: 68, maritalStatus: "married", memberStatus: "member", smallGroup: "Senior Saints" },
    ],
  },
  {
    label: "Walker — senior couple",
    lastName: "Walker",
    streetAddress: "2278 Silver Birch Way",
    city: "Fairview",
    state: "MD",
    zip: "20837",
    members: [
      { firstName: "George", gender: "Male", ageYears: 74, maritalStatus: "married", memberStatus: "member", ministry: "Ushers" },
      { firstName: "Dorothy", gender: "Female", ageYears: 72, maritalStatus: "married", memberStatus: "member", smallGroup: "Senior Saints" },
    ],
  },
  {
    label: "Young — senior couple",
    lastName: "Young",
    streetAddress: "2382 Autumn Lane",
    city: "Riverside",
    state: "DC",
    zip: "20005",
    members: [
      { firstName: "Harold", gender: "Male", ageYears: 66, maritalStatus: "married", memberStatus: "member" },
      { firstName: "Edna", gender: "Female", ageYears: 64, maritalStatus: "married", memberStatus: "member", smallGroup: "Senior Saints" },
    ],
  },
  {
    label: "Adams — senior single",
    lastName: "Adams",
    streetAddress: "2486 Morning Glory Court",
    city: "Oakwood",
    state: "PA",
    zip: "19105",
    members: [
      { firstName: "Helen", gender: "Female", ageYears: 78, maritalStatus: "widowed", memberStatus: "member", smallGroup: "Senior Saints" },
    ],
    note: "edge: elderly widow, no DOB set (will clear DOB for edge case)",
  },
  {
    label: "Jackson — secondary guardian household",
    lastName: "Jackson",
    streetAddress: "2590 Heritage Blvd",
    city: "Maplewood",
    state: "NC",
    zip: "28205",
    members: [
      { firstName: "Trevor", gender: "Male", ageYears: 45, maritalStatus: "married", memberStatus: "member", ministry: "Discipleship" },
      { firstName: "Cheryl", gender: "Female", ageYears: 43, maritalStatus: "married", memberStatus: "member", occupation: "Nurse" },
    ],
    children: [
      { firstName: "Evelyn", gender: "Female", ageYears: 8, hasSecondGuardian: true, secondGuardianIsEmergencyOnly: false },
    ],
    note: "edge: household with secondary guardian (aunt has authorized pickup)",
  },
];

// ─── Unaffiliated member distribution ─────────────────────────────────────────
// These are generated outside of household groups.
// Covers teens, extra active members, visitors, low-attendance members, ministry leaders.

function buildUnaffiliatedMembers(): Array<{
  firstName: string;
  lastName: string;
  gender: "Male" | "Female";
  ageYears: number;
  memberStatus: MemberStatus;
  ministry?: string;
  smallGroup?: string;
  occupation?: string;
}> {
  const members = [];

  // 20 teens (ages 13-17)
  const teenFirstM = ["Jaylen", "Brandon", "Tyler", "Nathan", "Cameron", "Xavier"];
  const teenFirstF = ["Destiny", "Aaliyah", "Jasmine", "Brianna", "Taylor", "Sydney"];
  for (let i = 0; i < 20; i++) {
    members.push({
      firstName: i % 2 === 0 ? teenFirstM[i % teenFirstM.length] : teenFirstF[i % teenFirstF.length],
      lastName: pick(EXTRA_LAST, i),
      gender: (i % 2 === 0 ? "Male" : "Female") as "Male" | "Female",
      ageYears: 13 + (i % 5),
      memberStatus: "member" as MemberStatus,
      smallGroup: "College Group",
    });
  }

  // 20 active adults (ages 22-58)
  for (let i = 0; i < 20; i++) {
    members.push({
      firstName: i % 2 === 0 ? pick(FIRST_M, i + 50) : pick(FIRST_F, i + 50),
      lastName: pick(EXTRA_LAST, i + 10),
      gender: (i % 2 === 0 ? "Male" : "Female") as "Male" | "Female",
      ageYears: 22 + (i % 37),
      memberStatus: "member" as MemberStatus,
      ministry: i % 2 === 0 ? pick(MINISTRIES, i) : undefined,
      smallGroup: i % 3 === 0 ? pick(SMALL_GROUPS, i) : undefined,
      occupation: pick(OCCUPATIONS, i),
    });
  }

  // 5 ministry leaders (active, with ministry)
  for (let i = 0; i < 5; i++) {
    members.push({
      firstName: pick(FIRST_M, i + 200),
      lastName: pick(EXTRA_LAST, i + 15),
      gender: "Male" as "Male" | "Female",
      ageYears: 35 + i * 4,
      memberStatus: "member" as MemberStatus,
      ministry: MINISTRIES[i],
    });
  }

  // 8 new members (memberStatus: "member")
  for (let i = 0; i < 8; i++) {
    members.push({
      firstName: i % 2 === 0 ? pick(FIRST_M, i + 300) : pick(FIRST_F, i + 300),
      lastName: pick(EXTRA_LAST, i + 5),
      gender: (i % 2 === 0 ? "Male" : "Female") as "Male" | "Female",
      ageYears: 20 + i * 3,
      memberStatus: "member" as MemberStatus,
      ministry: pick(MINISTRIES, i + 4),
    });
  }

  // 12 low-attendance members
  for (let i = 0; i < 12; i++) {
    members.push({
      firstName: i % 2 === 0 ? pick(FIRST_M, i + 400) : pick(FIRST_F, i + 400),
      lastName: pick(EXTRA_LAST, i + 8),
      gender: (i % 2 === 0 ? "Male" : "Female") as "Male" | "Female",
      ageYears: 25 + i * 3,
      memberStatus: "member" as MemberStatus,
    });
  }

  // 10 visitors (minimal data)
  for (let i = 0; i < 10; i++) {
    members.push({
      firstName: i % 2 === 0 ? pick(FIRST_M, i + 500) : pick(FIRST_F, i + 500),
      lastName: pick(EXTRA_LAST, i + 3),
      gender: (i % 2 === 0 ? "Male" : "Female") as "Male" | "Female",
      ageYears: 28 + i * 2,
      memberStatus: "visitor" as MemberStatus,
    });
  }

  return members;
}

// ─── Main seed function ───────────────────────────────────────────────────────
async function seedDev() {
  console.log("\n🌱 Church OS — Dev Seed Script");
  console.log("================================\n");

  if (process.env.NODE_ENV === "production") {
    console.error("❌  Refusing to seed dev data in production.");
    process.exit(1);
  }

  // ── Find the church ────────────────────────────────────────────────────────
  const [church] = await db
    .select()
    .from(schema.churchesTable)
    .where(eq(schema.churchesTable.slug, "cjc-international"));

  if (!church) {
    console.error("❌  Church 'cjc-international' not found. Run the base seed first:");
    console.error("    pnpm --filter @workspace/scripts run seed");
    process.exit(1);
  }
  console.log(`✅  Church: ${church.name} (id=${church.id})`);

  // ── Optional reset ─────────────────────────────────────────────────────────
  if (isReset) {
    console.log("\n🗑️  Resetting dev data...");

    // Wipe dev attendance records + sessions
    const devSessions = await db
      .select({ id: schema.attendanceSessionsTable.id })
      .from(schema.attendanceSessionsTable)
      .where(and(eq(schema.attendanceSessionsTable.churchId, church.id), like(schema.attendanceSessionsTable.qrToken, "qr_dev_%")));

    for (const session of devSessions) {
      await db.delete(schema.attendanceRecordsTable).where(eq(schema.attendanceRecordsTable.sessionId, session.id));
    }
    for (const session of devSessions) {
      await db.delete(schema.attendanceSessionsTable).where(eq(schema.attendanceSessionsTable.id, session.id));
    }

    // Wipe dev/base-seed children used by this local QA dataset.
    const devChildren = await db
      .select({ id: schema.childrenTable.id, firstName: schema.childrenTable.firstName })
      .from(schema.childrenTable)
      .where(eq(schema.childrenTable.churchId, church.id));

    const childrenToWipe = devChildren.filter((child) =>
      child.firstName.startsWith("Dev_") || ["Avery", "Noah", "Maya"].includes(child.firstName)
    );

    for (const child of childrenToWipe) {
      await db.delete(schema.checkinRecordsTable).where(eq(schema.checkinRecordsTable.childId, child.id));
      await db.delete(schema.childGuardianRelationshipsTable).where(eq(schema.childGuardianRelationshipsTable.childId, child.id));
      await db.delete(schema.childrenTable).where(eq(schema.childrenTable.id, child.id));
    }

    // Wipe dev/base-seed guardians
    const devGuardians = await db
      .select({ id: schema.parentGuardiansTable.id })
      .from(schema.parentGuardiansTable)
      .where(like(schema.parentGuardiansTable.email, `%${DEV_EMAIL_DOMAIN}`));
    const exampleGuardians = await db
      .select({ id: schema.parentGuardiansTable.id })
      .from(schema.parentGuardiansTable)
      .where(like(schema.parentGuardiansTable.email, "%@example.test"));

    for (const g of [...devGuardians, ...exampleGuardians]) {
      await db.delete(schema.childGuardianRelationshipsTable).where(eq(schema.childGuardianRelationshipsTable.guardianId, g.id));
      await db.delete(schema.parentGuardiansTable).where(eq(schema.parentGuardiansTable.id, g.id));
    }

    // Wipe dev users and the small base sample users before rebuilding the full QA dataset.
    const devUsers = await db
      .select({ id: schema.usersTable.id, email: schema.usersTable.email })
      .from(schema.usersTable)
      .where(like(schema.usersTable.email, `%${DEV_EMAIL_DOMAIN}`));
    const exampleUsers = await db
      .select({ id: schema.usersTable.id, email: schema.usersTable.email })
      .from(schema.usersTable)
      .where(like(schema.usersTable.email, "%@example.test"));

    const extraTestEmails = [
      ...EXTRA_TEST_USERS.map((u) => u.email),
      "finance@churchos.test",
      "attendance@churchos.test",
      "children@churchos.test",
      "admin@churchos.test",
    ];
    const extraTestUsers = await db
      .select({ id: schema.usersTable.id, email: schema.usersTable.email })
      .from(schema.usersTable)
      .where(like(schema.usersTable.email, "%@churchos.test"));

    const toWipe = [
      ...devUsers,
      ...exampleUsers,
      ...extraTestUsers.filter((u) => extraTestEmails.includes(u.email)),
    ];

    for (const u of toWipe) {
      const sessionsCreatedByUser = await db
        .select({ id: schema.attendanceSessionsTable.id })
        .from(schema.attendanceSessionsTable)
        .where(eq(schema.attendanceSessionsTable.createdByUserId, u.id));

      for (const session of sessionsCreatedByUser) {
        await db.delete(schema.attendanceRecordsTable).where(eq(schema.attendanceRecordsTable.sessionId, session.id));
      }
      for (const session of sessionsCreatedByUser) {
        await db.delete(schema.attendanceSessionsTable).where(eq(schema.attendanceSessionsTable.id, session.id));
      }

      await db.delete(schema.attendanceRecordsTable).where(eq(schema.attendanceRecordsTable.memberId, u.id));
      await db.delete(schema.attendanceRecordsTable).where(eq(schema.attendanceRecordsTable.checkedInByUserId, u.id));
      await db.delete(schema.checkinRecordsTable).where(eq(schema.checkinRecordsTable.checkedInByUserId, u.id));
      await db.delete(schema.checkinRecordsTable).where(eq(schema.checkinRecordsTable.checkedOutByUserId, u.id));
      await db.delete(schema.donationsTable).where(eq(schema.donationsTable.memberId, u.id));
      await db.delete(schema.recurringDonationsTable).where(eq(schema.recurringDonationsTable.memberId, u.id));
      await db.delete(schema.taxReceiptsTable).where(eq(schema.taxReceiptsTable.memberId, u.id));
      await db.delete(schema.taxReceiptsTable).where(eq(schema.taxReceiptsTable.generatedByUserId, u.id));
      await db.delete(schema.adminPermissionsTable).where(eq(schema.adminPermissionsTable.userId, u.id));
      await db.delete(schema.adminPermissionsTable).where(eq(schema.adminPermissionsTable.grantedByUserId, u.id));
      await db.delete(schema.adminInvitationsTable).where(eq(schema.adminInvitationsTable.invitedByUserId, u.id));
      await db.delete(schema.adminInvitationsTable).where(eq(schema.adminInvitationsTable.acceptedByUserId, u.id));
      await db.delete(schema.oauthAccountsTable).where(eq(schema.oauthAccountsTable.userId, u.id));
      await db.update(schema.eventsTable).set({ createdByUserId: null }).where(eq(schema.eventsTable.createdByUserId, u.id));
      await db.update(schema.givingCampaignsTable).set({ createdByUserId: null }).where(eq(schema.givingCampaignsTable.createdByUserId, u.id));
      await db.update(schema.churchProfileSettingsTable).set({ updatedByUserId: null }).where(eq(schema.churchProfileSettingsTable.updatedByUserId, u.id));
      await db.update(schema.systemSettingsTable).set({ updatedByUserId: null }).where(eq(schema.systemSettingsTable.updatedByUserId, u.id));
    }
    for (const u of toWipe) {
      await db.delete(schema.usersTable).where(eq(schema.usersTable.id, u.id));
    }

    console.log("   Dev data cleared.\n");
  }

  // ── Extra test users ───────────────────────────────────────────────────────
  console.log("👤  Seeding extra test users...");
  let [adminUser] = await db
    .select({ id: schema.usersTable.id })
    .from(schema.usersTable)
    .where(eq(schema.usersTable.email, "superadmin@churchos.test"));

  for (const u of EXTRA_TEST_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    const [user] = await db
      .insert(schema.usersTable)
      .values({
        churchId: church.id,
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        adminLevel: u.adminLevel,
        accountStatus: u.accountStatus,
        memberStatus: u.memberStatus,
        assignedMinistry: u.assignedMinistry,
        ministryDepartment: u.assignedMinistry,
        servingStatus: "serving",
        baptismStatus: "baptized",
        isActive: true,
      })
      .onConflictDoUpdate({
        target: schema.usersTable.email,
        set: {
          firstName: u.firstName,
          lastName: u.lastName,
          passwordHash,
          role: u.role,
          adminLevel: u.adminLevel,
          accountStatus: u.accountStatus,
          memberStatus: u.memberStatus,
          assignedMinistry: u.assignedMinistry,
          ministryDepartment: u.assignedMinistry,
          servingStatus: u.assignedMinistry ? "serving" : "not_serving",
          isActive: true,
        },
      })
      .returning();

    if (u.email === "superadmin@churchos.test") {
      adminUser = { id: user.id };
    }

    await db.delete(schema.adminPermissionsTable).where(eq(schema.adminPermissionsTable.userId, user.id));
    if (u.permissions.length > 0) {
      await db.insert(schema.adminPermissionsTable).values(
        u.permissions.map((permission) => ({
          userId: user.id,
          permission,
          grantedByUserId: adminUser?.id ?? user.id,
        }))
      );
    }
    console.log(`   ${user.role}/${user.adminLevel}: ${user.email}`);
  }

  // Keep the Services & Events calendar aligned with the attendance seed:
  // discipleship is a service/session type, not a separate event system.
  const discipleshipStart = new Date("2026-05-22T23:00:00");
  const discipleshipEnd = new Date("2026-05-23T01:00:00");
  const discipleshipEventValues = {
    churchId: church.id,
    title: "Friday Night Discipleship",
    eventType: "discipleship" as const,
    description: "Weekly discipleship service for tagged discipleship participants. This session crosses midnight.",
    startDatetime: discipleshipStart,
    endDatetime: discipleshipEnd,
    location: "Main Sanctuary",
    eventMode: "in_person" as const,
    zoomLink: null,
    youtubeLink: null,
    posterUrl: null,
    isRecurring: true,
    recurrencePattern: "weekly" as const,
    recurrenceDay: discipleshipStart.getDay(),
    recurrenceTime: `${String(discipleshipStart.getHours()).padStart(2, "0")}:${String(discipleshipStart.getMinutes()).padStart(2, "0")}`,
    visibility: "public" as const,
    status: "published" as const,
    createdByUserId: adminUser?.id ?? null,
  };
  const [existingDiscipleshipEvent] = await db
    .select({ id: schema.eventsTable.id })
    .from(schema.eventsTable)
    .where(and(eq(schema.eventsTable.churchId, church.id), eq(schema.eventsTable.title, "Friday Night Discipleship")));
  if (existingDiscipleshipEvent) {
    await db.update(schema.eventsTable).set(discipleshipEventValues).where(eq(schema.eventsTable.id, existingDiscipleshipEvent.id));
  } else {
    await db.insert(schema.eventsTable).values(discipleshipEventValues);
  }
  console.log("   event: Friday Night Discipleship (published)");

  // ── Household members ──────────────────────────────────────────────────────
  console.log("\n🏠  Seeding 45 household groups...");

  // Track generated user IDs per household for guardian linking
  type HouseholdRecord = {
    blueprint: HouseholdBlueprint;
    memberIds: number[];
  };
  const householdRecords: HouseholdRecord[] = [];
  let householdMemberCount = 0;

  for (const hh of HOUSEHOLDS) {
    const memberIds: number[] = [];

    for (let mi = 0; mi < hh.members.length; mi++) {
      const m = hh.members[mi];
      const emailLocal = `${slug(m.firstName)}.${slug(hh.lastName)}.hh${DEV_EMAIL_DOMAIN}`;
      const accountStatus = accountStatusFor(m.memberStatus);
      const dob = dobFromAge(m.ageYears, mi * 17); // slight offset so spouses have different exact DOBs

      const [user] = await db
        .insert(schema.usersTable)
        .values({
          churchId: church.id,
          email: emailLocal,
          firstName: m.firstName,
          lastName: hh.lastName,
          role: "member",
          adminLevel: null,
          accountStatus,
          memberStatus: m.memberStatus,
          isActive: accountStatus === "active",
          dateOfBirth: dob,
          gender: m.gender,
          maritalStatus: m.maritalStatus,
          phoneNumber: `555-${String(2000 + householdMemberCount).slice(-4)}`,
          streetAddress: hh.streetAddress,
          city: hh.city,
          state: hh.state,
          zipCode: hh.zip,
          assignedMinistry: m.ministry ?? null,
          ministryDepartment: m.ministry ?? null,
          smallGroup: m.smallGroup ?? null,
          occupation: m.occupation ?? pick(OCCUPATIONS, householdMemberCount),
          servingStatus: m.ministry ? "serving" : "not_serving",
          baptismStatus: m.memberStatus === "visitor" ? "unknown" : "baptized",
          joinDate: m.memberStatus !== "visitor" ? "2021-01-01" : null,
          emergencyContactName: mi === 0 && hh.members.length > 1
            ? `${hh.members[1].firstName} ${hh.lastName}`
            : `Emergency Contact`,
          emergencyContactPhoneNumber: `555-E${String(100 + householdMemberCount).slice(-3)}`,
          emergencyContactRelationship: mi === 0 && hh.members.length > 1 ? "Spouse" : "Family",
          preferredContactMethod: (["email", "text", "phone"] as const)[householdMemberCount % 3],
        })
        .onConflictDoUpdate({
          target: schema.usersTable.email,
          set: {
            firstName: m.firstName,
            lastName: hh.lastName,
            memberStatus: m.memberStatus,
            accountStatus,
            isActive: accountStatus === "active",
            maritalStatus: m.maritalStatus,
          },
        })
        .returning();

      memberIds.push(user.id);
      householdMemberCount++;
    }

    householdRecords.push({ blueprint: hh, memberIds });
  }

  console.log("   Adding 20 supplemental households to reach the 200-person QA dataset...");
  for (let hi = 0; hi < 20; hi++) {
    const lastName = SUPPLEMENTAL_LAST[hi];
    const address = householdAddress(hi);
    const memberCount = hi < 18 ? 2 : 3;
    const memberIds: number[] = [];

    for (let mi = 0; mi < memberCount; mi++) {
      const isSeniorCouple = hi < 18;
      const gender = (mi % 2 === 0 ? "Male" : "Female") as "Male" | "Female";
      const firstName = gender === "Male" ? pick(FIRST_M, hi + mi + 90) : pick(FIRST_F, hi + mi + 90);
      const ministry = hi % 2 === 0 && mi === 0 ? pick(MINISTRIES, hi) : null;
      const ageYears = isSeniorCouple ? 60 + ((hi + mi * 3) % 24) : 24 + ((hi + mi * 4) % 13);
      const maritalStatus = isSeniorCouple ? (mi < 2 ? "married" : "single") : "single";
      const email = `${slug(firstName)}.${slug(lastName)}.supp${hi}${mi}${DEV_EMAIL_DOMAIN}`;

      const [user] = await db
        .insert(schema.usersTable)
        .values({
          churchId: church.id,
          email,
          firstName,
          lastName,
          role: "member",
          adminLevel: null,
          accountStatus: "active",
          memberStatus: "member",
          isActive: true,
          dateOfBirth: dobFromAge(ageYears, hi * 11 + mi * 19),
          gender,
          maritalStatus,
          phoneNumber: `555-${String(4200 + householdMemberCount).slice(-4)}`,
          streetAddress: address.streetAddress,
          city: address.city,
          state: address.state,
          zipCode: address.zip,
          assignedMinistry: ministry,
          ministryDepartment: ministry,
          smallGroup: isSeniorCouple ? "Senior Saints" : pick(SMALL_GROUPS, hi + mi),
          occupation: pick(OCCUPATIONS, hi + mi),
          servingStatus: ministry ? "serving" : "not_serving",
          baptismStatus: "baptized",
          joinDate: "2020-09-01",
          emergencyContactName: `Emergency ${lastName}`,
          emergencyContactPhoneNumber: `555-S${String(200 + hi + mi).slice(-3)}`,
          emergencyContactRelationship: isSeniorCouple ? "Spouse" : "Family",
          preferredContactMethod: (["email", "text", "phone"] as const)[(hi + mi) % 3],
        })
        .onConflictDoUpdate({
          target: schema.usersTable.email,
          set: {
            firstName,
            lastName,
            accountStatus: "active",
            memberStatus: "member",
            isActive: true,
            servingStatus: ministry ? "serving" : "not_serving",
          },
        })
        .returning();

      memberIds.push(user.id);
      householdMemberCount++;
    }

    const supplementalChildren: HouseholdChildDef[] = hi < 13
      ? [{
          firstName: SUPPLEMENTAL_CHILDREN[hi],
          gender: (hi % 2 === 0 ? "Female" : "Male") as "Male" | "Female",
          ageYears: 2 + (hi % 11),
          hasSecondGuardian: memberIds.length > 1,
        }]
      : [];

    householdRecords.push({
      blueprint: {
        label: `${lastName} supplemental household`,
        lastName,
        ...address,
        members: [],
        children: supplementalChildren,
      },
      memberIds,
    });
  }

  // Edge case: clear DOB for the senior widow (Adams family, last member of HH24-equivalent)
  const adamsUser = await db
    .select({ id: schema.usersTable.id })
    .from(schema.usersTable)
    .where(eq(schema.usersTable.email, `helen.adams.hh${DEV_EMAIL_DOMAIN}`));

  if (adamsUser[0]) {
    await db.update(schema.usersTable)
      .set({ dateOfBirth: null })
      .where(eq(schema.usersTable.id, adamsUser[0].id));
  }

  console.log(`   Household members created: ${householdMemberCount}`);

  // ── Unaffiliated members ───────────────────────────────────────────────────
  console.log("\n👥  Seeding unaffiliated members (teens, adults, visitors, low-attendance)...");

  const unaffiliated = buildUnaffiliatedMembers();
  const unaffiliatedIds: number[] = [];
  let unaffiliatedCount = 0;

  for (let i = 0; i < unaffiliated.length; i++) {
    const m = unaffiliated[i];
    const emailLocal = `${slug(m.firstName)}.${slug(m.lastName)}${i}${DEV_EMAIL_DOMAIN}`;
    const accountStatus = accountStatusFor(m.memberStatus);
    const dob = m.memberStatus !== "visitor" || i % 3 !== 0 ? dobFromAge(m.ageYears, i * 7) : null; // some visitors have no DOB

    const [user] = await db
      .insert(schema.usersTable)
      .values({
        churchId: church.id,
        email: emailLocal,
        firstName: m.firstName,
        lastName: m.lastName,
        role: "member",
        adminLevel: null,
        accountStatus,
        memberStatus: m.memberStatus,
        isActive: accountStatus === "active",
        dateOfBirth: dob,
        gender: m.gender,
        maritalStatus: m.memberStatus === "visitor" ? null : "single",
        phoneNumber: m.memberStatus !== "visitor" ? `555-${String(3000 + i).slice(-4)}` : null,
        streetAddress: m.memberStatus !== "visitor" ? `${200 + i} Unaffiliated Street` : null,
        city: m.memberStatus !== "visitor" ? pick(["Springfield", "Fairview", "Riverside"], i) : null,
        state: m.memberStatus !== "visitor" ? pick(["VA", "MD", "DC"], i) : null,
        zipCode: m.memberStatus !== "visitor" ? `2215${i % 9}` : null,
        assignedMinistry: m.ministry ?? null,
        smallGroup: m.smallGroup ?? null,
        occupation: m.occupation ?? null,
        servingStatus: m.ministry ? "serving" : "not_serving",
        baptismStatus: m.memberStatus === "visitor" ? "unknown" : i % 4 === 0 ? "not_baptized" : "baptized",
        joinDate: m.memberStatus !== "visitor" ? "2023-03-01" : null,
        emergencyContactName: m.memberStatus !== "visitor" ? `Emergency ${i}` : null,
        emergencyContactPhoneNumber: m.memberStatus !== "visitor" ? `555-9${String(i).padStart(3, "0")}` : null,
        emergencyContactRelationship: m.memberStatus !== "visitor" ? "Family" : null,
        preferredContactMethod: (["email", "text", "phone"] as const)[i % 3],
      })
      .onConflictDoUpdate({
        target: schema.usersTable.email,
        set: {
          firstName: m.firstName,
          memberStatus: m.memberStatus,
          accountStatus,
          isActive: accountStatus === "active",
        },
      })
      .returning();

    unaffiliatedIds.push(user.id);
    unaffiliatedCount++;
  }

  console.log(`   Unaffiliated members: ${unaffiliatedCount}`);

  // ── Fetch all members for attendance/giving ────────────────────────────────
  const seededTestEmails = new Set(EXTRA_TEST_USERS.map((u) => u.email));
  const churchUsers = await db
    .select({
      id: schema.usersTable.id,
      email: schema.usersTable.email,
      firstName: schema.usersTable.firstName,
      lastName: schema.usersTable.lastName,
      memberStatus: schema.usersTable.memberStatus,
      servingStatus: schema.usersTable.servingStatus,
    })
    .from(schema.usersTable)
    .where(eq(schema.usersTable.churchId, church.id));

  const allMembers = churchUsers.filter((user) =>
    user.email.endsWith(DEV_EMAIL_DOMAIN) || seededTestEmails.has(user.email)
  );

  const activeMembers = allMembers.filter((m) => m.memberStatus === "member");
  const lowAttendanceMembers = activeMembers.slice(-12);
  const visitors = allMembers.filter((m) => m.memberStatus === "visitor");
  const servingMembers = allMembers.filter((m) => m.servingStatus === "serving");

  console.log(`\n   Total members in church: ${allMembers.length}`);
  console.log(`   Members: ${activeMembers.length}  Low-attendance test members: ${lowAttendanceMembers.length}  Visitors: ${visitors.length}`);

  // ── Children + guardians ───────────────────────────────────────────────────
  console.log("\n👶  Seeding 35 children with household guardian links...");

  // Collect all household children to seed
  const childDefs: Array<{
    child: HouseholdChildDef;
    lastName: string;
    guardianMemberIds: number[];
  }> = [];

  for (const hr of householdRecords) {
    const hh = hr.blueprint;
    if (!hh.children || hh.children.length === 0) continue;
    for (const child of hh.children) {
      childDefs.push({
        child,
        lastName: hh.lastName,
        guardianMemberIds: hr.memberIds,
      });
    }
  }

  const createdChildren: Array<{ id: number; guardianIds: number[] }> = [];

  for (let ci = 0; ci < childDefs.length; ci++) {
    const { child, lastName, guardianMemberIds } = childDefs[ci];
    const ageYears = child.ageYears;
    const classroom: typeof CLASSROOMS[number] = ageYears <= 3 ? "Toddlers" : ageYears <= 5 ? "Preschool" : "Elementary";
    const allergy = ALLERGY_POOL[ci % ALLERGY_POOL.length];
    const medical = MEDICAL_POOL[ci % MEDICAL_POOL.length];

    const [createdChild] = await db
      .insert(schema.childrenTable)
      .values({
        churchId: church.id,
        firstName: `Dev_${child.firstName}`,
        lastName,
        dateOfBirth: dobFromAge(ageYears, ci * 23),
        gender: child.gender,
        classroom,
        allergyInformation: allergy,
        medicalNotes: medical,
        specialInstructions: ci === 0 ? "Release only to listed guardians" : null,
        checkinStatus: "checked_out",
      })
      .onConflictDoNothing()
      .returning();

    if (!createdChild) continue;

    const guardianIds: number[] = [];

    // Primary guardian — use first parent member's info
    const primaryMemberId = guardianMemberIds[0];
    const [primaryMember] = await db
      .select({ firstName: schema.usersTable.firstName, lastName: schema.usersTable.lastName, email: schema.usersTable.email, phoneNumber: schema.usersTable.phoneNumber })
      .from(schema.usersTable)
      .where(eq(schema.usersTable.id, primaryMemberId));

    if (primaryMember) {
      const [guardian1] = await db
        .insert(schema.parentGuardiansTable)
        .values({
          churchId: church.id,
          name: `${primaryMember.firstName} ${primaryMember.lastName}`,
          email: primaryMember.email,
          phoneNumber: primaryMember.phoneNumber ?? `555-G${String(100 + ci).slice(-3)}`,
        })
        .onConflictDoNothing()
        .returning();

      if (guardian1) {
        await db
          .insert(schema.childGuardianRelationshipsTable)
          .values({ childId: createdChild.id, guardianId: guardian1.id, relationship: "parent", authorizedPickup: true })
          .onConflictDoNothing();
        guardianIds.push(guardian1.id);
      }
    }

    // Secondary guardian — second household parent or emergency-only contact
    if (child.hasSecondGuardian && guardianMemberIds.length > 1) {
      const secondMemberId = guardianMemberIds[1];
      const [secondMember] = await db
        .select({ firstName: schema.usersTable.firstName, lastName: schema.usersTable.lastName, email: schema.usersTable.email, phoneNumber: schema.usersTable.phoneNumber })
        .from(schema.usersTable)
        .where(eq(schema.usersTable.id, secondMemberId));

      if (secondMember) {
        const [guardian2] = await db
          .insert(schema.parentGuardiansTable)
          .values({
            churchId: church.id,
            name: `${secondMember.firstName} ${secondMember.lastName}`,
            email: secondMember.email,
            phoneNumber: secondMember.phoneNumber ?? `555-H${String(100 + ci).slice(-3)}`,
          })
          .onConflictDoNothing()
          .returning();

        if (guardian2) {
          const rel: "parent" | "guardian" | "emergency_contact" = child.secondGuardianIsEmergencyOnly ? "emergency_contact" : "parent";
          await db
            .insert(schema.childGuardianRelationshipsTable)
            .values({
              childId: createdChild.id,
              guardianId: guardian2.id,
              relationship: rel,
              authorizedPickup: !child.secondGuardianIsEmergencyOnly,
            })
            .onConflictDoNothing();
          guardianIds.push(guardian2.id);
        }
      }
    } else if (child.hasSecondGuardian && child.secondGuardianIsEmergencyOnly) {
      // External emergency contact (not a church member)
      const [extGuardian] = await db
        .insert(schema.parentGuardiansTable)
        .values({
          churchId: church.id,
          name: `Aunt Carol ${lastName}`,
          email: `aunt.carol.${slug(lastName)}.ext${DEV_EMAIL_DOMAIN}`,
          phoneNumber: `555-X${String(100 + ci).slice(-3)}`,
        })
        .onConflictDoNothing()
        .returning();

      if (extGuardian) {
        await db
          .insert(schema.childGuardianRelationshipsTable)
          .values({ childId: createdChild.id, guardianId: extGuardian.id, relationship: "emergency_contact", authorizedPickup: false })
          .onConflictDoNothing();
        guardianIds.push(extGuardian.id);
      }
    }

    createdChildren.push({ id: createdChild.id, guardianIds });
  }

  console.log(`   Children created: ${createdChildren.length}`);
  console.log(`   Children with 2 guardians: ${createdChildren.filter((c) => c.guardianIds.length >= 2).length}`);
  console.log(`   Children with 1 guardian (single-parent): ${createdChildren.filter((c) => c.guardianIds.length === 1).length}`);

  // ── Attendance sessions (48: 4 services × 12 weeks) ───────────────────────
  console.log("\n📅  Seeding 48 attendance sessions (4 services × 12 weeks)...");

  const serviceEvents = await db
    .select({ id: schema.eventsTable.id, title: schema.eventsTable.title, recurrenceDay: schema.eventsTable.recurrenceDay })
    .from(schema.eventsTable)
    .where(and(eq(schema.eventsTable.churchId, church.id), eq(schema.eventsTable.eventType, "service")));

  const servicesByDay = new Map<number, { id: number; title: string }>();
  for (const ev of serviceEvents) {
    if (ev.recurrenceDay !== null) {
      servicesByDay.set(ev.recurrenceDay, { id: ev.id, title: ev.title });
    }
  }

  // Expected attendance ranges per day-of-week
  const attendanceRanges: Record<number, [number, number]> = {
    4: [50, 80],   // Thursday
    5: [60, 95],   // Friday
    6: [70, 110],  // Saturday
    0: [120, 180], // Sunday (highest)
  };

  const serviceDays = [4, 5, 6, 0];
  const serviceStartTimes: Record<number, string> = { 4: "19:00", 5: "19:00", 6: "19:00", 0: "11:00" };

  const allCreatedSessions: Array<{ id: number; dayOfWeek: number; sessionDate: Date }> = [];

  for (const dayOfWeek of serviceDays) {
    const eventInfo = servicesByDay.get(dayOfWeek);
    const pastDates = pastDayOccurrences(dayOfWeek, 12);
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

      const existing = await db
        .select({ id: schema.attendanceSessionsTable.id })
        .from(schema.attendanceSessionsTable)
        .where(
          and(
            eq(schema.attendanceSessionsTable.churchId, church.id),
            eq(schema.attendanceSessionsTable.sessionDate, sessionDate),
            eq(schema.attendanceSessionsTable.sessionName, sessionValues.sessionName)
          )
        );

      let sessionId: number;
      if (existing[0]) {
        sessionId = existing[0].id;
      } else {
        const [session] = await db.insert(schema.attendanceSessionsTable).values(sessionValues).returning();
        sessionId = session.id;
      }

      allCreatedSessions.push({ id: sessionId, dayOfWeek, sessionDate });

      // Generate attendance — realistic variation per week
      const targetCount = seededInt(sessionId + w, range[0], range[1]);
      const shuffledMembers = shuffle(activeMembers, sessionId + w * 7);
      const attendees = shuffledMembers.slice(0, Math.min(targetCount, shuffledMembers.length));

      // Edge case: member with old attendance history but little/no recent attendance.
      if (lowAttendanceMembers.length > 0 && w >= 6) {
        attendees.push(lowAttendanceMembers[0]);
      }

      // Edge case: visitor attending once (Sunday sessions only)
      if (dayOfWeek === 0 && visitors.length > 0 && w === 3) {
        attendees.push(visitors[0]);
      }

      for (const attendee of attendees) {
        const checkinTime = new Date(sessionDate);
        const [startHour, startMin] = (serviceStartTimes[dayOfWeek]).split(":").map(Number);
        checkinTime.setHours(startHour, (startMin ?? 0) + Math.floor(Math.random() * 30), 0, 0);

        await db
          .insert(schema.attendanceRecordsTable)
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

  // ── Discipleship attendance sessions (same attendance system, cross-midnight) ──
  console.log("\n📖  Seeding Friday discipleship sessions (11 PM–1 AM, crosses midnight)...");

  const discipleshipMembers = shuffle(activeMembers, 777).slice(0, 30);
  for (const member of discipleshipMembers) {
    await db.update(schema.usersTable)
      .set({
        smallGroup: "Friday Discipleship",
        ...(member.id % 5 === 0 ? { assignedMinistry: "Discipleship", ministryDepartment: "Discipleship" } : {}),
      })
      .where(eq(schema.usersTable.id, member.id));
  }

  const discipleshipDates = pastDayOccurrences(5, 12);
  const discipleshipSessions: Array<{ id: number; sessionDate: Date }> = [];

  for (let w = 0; w < discipleshipDates.length; w++) {
    const sessionDate = discipleshipDates[w];
    sessionDate.setHours(23, 0, 0, 0);
    const qrToken = makeQrToken(`discipleship_w${w}`);
    const lessonTopic = [
      "Foundations of Faith",
      "Prayer and Fasting",
      "Serving with Humility",
      "Evangelism Practice",
      "Spiritual Gifts",
      "Walking in Holiness",
      "Leadership and Accountability",
      "Doctrine Review",
      "Faith Under Pressure",
      "The Cost of Discipleship",
      "Serving the Local Church",
      "Mission and Witness",
    ][w % 12];

    const existing = await db
      .select({ id: schema.attendanceSessionsTable.id })
      .from(schema.attendanceSessionsTable)
      .where(and(
        eq(schema.attendanceSessionsTable.churchId, church.id),
        eq(schema.attendanceSessionsTable.sessionDate, sessionDate),
        eq(schema.attendanceSessionsTable.sessionName, "Friday Night Discipleship"),
      ));

    const sessionId = existing[0]?.id ?? (await db.insert(schema.attendanceSessionsTable).values({
      churchId: church.id,
      attendanceType: "discipleship",
      serviceEventId: null,
      sessionName: "Friday Night Discipleship",
      sessionDate,
      startTime: "23:00",
      location: "Main Sanctuary",
      discipleshipGroup: "Friday Night Discipleship",
      teacherLeader: "Pastoral Team",
      lessonTopic,
      qrToken,
      qrEnabled: true,
      qrExpiration: new Date(sessionDate.getTime() + 2 * 3600_000),
      sessionStatus: "closed",
      createdByUserId: adminUser?.id ?? null,
    }).returning())[0].id;

    discipleshipSessions.push({ id: sessionId, sessionDate });
    const attendanceTarget = w === 2 ? 20 : seededInt(w + 91, 24, 40);
    const attendees = shuffle(discipleshipMembers, w + 515).slice(0, Math.min(attendanceTarget, discipleshipMembers.length));

    for (const attendee of attendees) {
      const checkinTime = new Date(sessionDate);
      checkinTime.setMinutes(45 + (attendee.id % 25));
      await db.insert(schema.attendanceRecordsTable).values({
        sessionId,
        memberId: attendee.id,
        attendanceStatus: "present",
        checkinSource: attendee.id % 3 === 0 ? "qr_self_checkin" : "manual_admin",
        checkinTime,
        checkedInByUserId: adminUser?.id ?? attendee.id,
        completionStatus: "attended",
        followUpNeeded: w === 0 && attendee.id % 11 === 0,
      }).onConflictDoNothing();
    }
  }

  const sundaySessions = allCreatedSessions
    .filter((s) => s.dayOfWeek === 0)
    .sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime());

  console.log(`   Sessions created: ${allCreatedSessions.length} (${sundaySessions.length} Sundays)`);

  // ── Children check-in (Sundays only) ──────────────────────────────────────
  console.log("\n✅  Seeding Sunday children check-in records...");

  let totalCheckins = 0;

  for (let si = 0; si < sundaySessions.length; si++) {
    const session = sundaySessions[si];
    const childCount = seededInt(si + 7, 18, 30);
    const shuffledChildren = shuffle(createdChildren, si * 13);
    const checkinChildren = shuffledChildren.slice(0, Math.min(childCount, shuffledChildren.length));

    for (let ci = 0; ci < checkinChildren.length; ci++) {
      const childData = checkinChildren[ci];
      const checkinTime = new Date(session.sessionDate);
      checkinTime.setHours(10, 30 + Math.floor(Math.random() * 30), 0, 0);

      // Edge case: last session, first 2 children have no checkout (unresolved)
      const isEdgeCaseMissing = si === sundaySessions.length - 1 && ci < 2;
      const hasCheckout = !isEdgeCaseMissing;
      const checkoutTime = hasCheckout ? new Date(checkinTime.getTime() + 90 * 60_000) : null;
      const firstGuardianId = childData.guardianIds[0] ?? null;

      await db
        .insert(schema.checkinRecordsTable)
        .values({
          childId: childData.id,
          checkedInByUserId: adminUser?.id ?? 1,
          checkedOutByUserId: hasCheckout ? (adminUser?.id ?? null) : null,
          pickedUpByGuardianId: hasCheckout ? firstGuardianId : null,
          checkinTime,
          checkoutTime,
          classroom: "Elementary",
          pickupCode: makePickupCode(session.id + ci),
          status: hasCheckout ? "checked_out" : "active",
        })
        .onConflictDoNothing();

      totalCheckins++;

      // Intentional historical duplicate QA case: same child was checked in twice
      // on an older Sunday, but both records are already closed so there are no
      // duplicate active check-ins.
      if (si === 0 && ci === 0 && hasCheckout) {
        await db
          .insert(schema.checkinRecordsTable)
          .values({
            childId: childData.id,
            checkedInByUserId: adminUser?.id ?? 1,
            checkedOutByUserId: adminUser?.id ?? null,
            pickedUpByGuardianId: firstGuardianId,
            checkinTime: new Date(checkinTime.getTime() + 5 * 60_000),
            checkoutTime: checkoutTime ? new Date(checkoutTime.getTime() + 5 * 60_000) : null,
            classroom: "Elementary",
            pickupCode: makePickupCode(session.id + ci + 99),
            status: "checked_out",
          })
          .onConflictDoNothing();
        totalCheckins++;
      }
    }
  }

  // Set checkin_status on children that have active check-in records
  const allDevChildren = await db
    .select({ id: schema.childrenTable.id })
    .from(schema.childrenTable)
    .where(and(eq(schema.childrenTable.churchId, church.id), like(schema.childrenTable.firstName, "Dev_%")));

  for (const c of allDevChildren) {
    const activeRecord = await db
      .select({ id: schema.checkinRecordsTable.id })
      .from(schema.checkinRecordsTable)
      .where(and(eq(schema.checkinRecordsTable.childId, c.id), eq(schema.checkinRecordsTable.status, "active")));

    await db.update(schema.childrenTable)
      .set({ checkinStatus: activeRecord.length > 0 ? "checked_in" : "checked_out" })
      .where(eq(schema.childrenTable.id, c.id));
  }

  console.log(`   Check-in records: ${totalCheckins}`);

  // ── Giving campaigns ───────────────────────────────────────────────────────
  console.log("\n💰  Seeding giving campaigns...");

  const DEV_CAMPAIGNS = [
    {
      campaignName: "Annual Building Fund 2026",
      description: "Expand our main sanctuary to seat 600 people.",
      goalAmountCents: 15_000_000,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      status: "active" as const,
      campaignCategory: "Building Fund",
    },
    {
      campaignName: "Community Gift Offering 2026",
      description: "Support benevolence, outreach, and special church care needs.",
      goalAmountCents: 4_500_000,
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-09-30"),
      status: "active" as const,
      campaignCategory: "Gift/Offering",
    },
  ];

  const campaignIdMap = new Map<string, number>();
  for (const camp of DEV_CAMPAIGNS) {
    const existing = await db
      .select({ id: schema.givingCampaignsTable.id })
      .from(schema.givingCampaignsTable)
      .where(and(eq(schema.givingCampaignsTable.churchId, church.id), eq(schema.givingCampaignsTable.campaignName, camp.campaignName)));

    const [campaign] = existing[0]
      ? await db
          .update(schema.givingCampaignsTable)
          .set({ ...camp, churchId: church.id, createdByUserId: adminUser?.id ?? null })
          .where(eq(schema.givingCampaignsTable.id, existing[0].id))
          .returning()
      : await db
          .insert(schema.givingCampaignsTable)
          .values({ ...camp, churchId: church.id, createdByUserId: adminUser?.id ?? null })
          .returning();

    campaignIdMap.set(campaign.campaignName, campaign.id);
    console.log(`   campaign: ${campaign.campaignName}`);
  }

  // ── Donations ──────────────────────────────────────────────────────────────
  console.log("\n💳  Seeding donations (150–300 successful transactions + 25 recurring tithe plans)...");

  const GIVING_CATEGORIES = ["tithe", "offering", "building_fund"] as const;

  // 60+ active members get donation records.
  const givingMembers = shuffle(activeMembers, 42).slice(0, 65);
  const recurringMembers = givingMembers.slice(0, 25);

  let donationCount = 0;
  let recurringCount = 0;
  const regularSessionsByDate = [...allCreatedSessions].sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime());
  let donationServiceCursor = 0;
  const nextGivingServiceSessionId = () => {
    if (regularSessionsByDate.length === 0) return null;
    const session = regularSessionsByDate[donationServiceCursor % regularSessionsByDate.length];
    donationServiceCursor++;
    return session.id;
  };

  // One-time donations spread over 12 weeks
  for (let di = 0; di < givingMembers.length; di++) {
    const donor = givingMembers[di];
    const donationsThisMember = 2 + (di % 3); // 2-4 donations per member

    for (let k = 0; k < donationsThisMember; k++) {
      const weeksAgo = (k * 2 + (di % 6)) % 12;
      const donationDate = new Date(Date.now() - weeksAgo * 7 * 24 * 3600_000);
      const serviceSessionId = nextGivingServiceSessionId();
      const amountCents = seededInt(di * 7 + k, 1000, di === 0 && k === 0 ? 250000 : 180000);
      const category = GIVING_CATEGORIES[di % GIVING_CATEGORIES.length];

      const campaignId =
        category === "building_fund"
          ? (campaignIdMap.get("Annual Building Fund 2026") ?? null)
          : category === "offering"
          ? (campaignIdMap.get("Community Gift Offering 2026") ?? null)
          : null;

      const csId = `cs_test_dev_${di}_${k}_${donor.id}`;
      const piId = `pi_test_dev_${di}_${k}_${donor.id}`;

      const existing = await db
        .select({ id: schema.donationsTable.id })
        .from(schema.donationsTable)
        .where(eq(schema.donationsTable.stripeCheckoutSessionId, csId));

      if (!existing[0]) {
        await db.insert(schema.donationsTable).values({
          churchId: church.id,
          memberId: donor.id,
          donorName: `${donor.firstName} ${donor.lastName}`,
          donorEmail: donor.email,
          amountCents,
          donationDate,
          donationType: "one_time",
          givingCategory: category,
          serviceSessionId,
          campaignId,
          stripeCheckoutSessionId: csId,
          stripePaymentIntentId: piId,
          stripeCustomerId: `cus_test_dev_${di}_${donor.id}`,
          stripeReceiptUrl: `https://pay.stripe.com/receipts/test_${piId}`,
          paymentStatus: "succeeded",
          taxDeductible: true,
          receiptIssued: di % 3 === 0,
        });
        donationCount++;
      }
    }
  }

  // Edge case: visitor one-time gift
  if (visitors.length > 0) {
    const visitor = visitors[0];
    const csId = `cs_test_dev_visitor_0`;
    const existing = await db
      .select({ id: schema.donationsTable.id })
      .from(schema.donationsTable)
      .where(eq(schema.donationsTable.stripeCheckoutSessionId, csId));

    if (!existing[0]) {
      const donationDate = new Date(Date.now() - 14 * 24 * 3600_000);
      await db.insert(schema.donationsTable).values({
        churchId: church.id,
        memberId: visitor.id,
        donorName: "Dev Visitor",
        donorEmail: visitor.email,
        amountCents: 2500,
        donationDate,
        donationType: "one_time",
        givingCategory: "offering",
        serviceSessionId: nextGivingServiceSessionId(),
        campaignId: null,
        stripeCheckoutSessionId: csId,
        stripePaymentIntentId: "pi_test_dev_visitor_0",
        stripeCustomerId: `cus_test_dev_visitor_${visitor.id}`,
        paymentStatus: "succeeded",
        taxDeductible: true,
        receiptIssued: false,
      });
      donationCount++;
    }
  }

  // Edge case: member with old giving history but little/no recent attendance.
  if (lowAttendanceMembers.length > 0) {
    const lowAttendance = lowAttendanceMembers[0];
    const csId = `cs_test_dev_low_attendance_old`;
    const existing = await db
      .select({ id: schema.donationsTable.id })
      .from(schema.donationsTable)
      .where(eq(schema.donationsTable.stripeCheckoutSessionId, csId));

    if (!existing[0]) {
      const donationDate = new Date("2025-06-15T12:00:00Z");
      await db.insert(schema.donationsTable).values({
        churchId: church.id,
        memberId: lowAttendance.id,
        donorName: "Dev Low-attendance Member",
        donorEmail: lowAttendance.email,
        amountCents: 5000,
        donationDate,
        donationType: "one_time",
        givingCategory: "tithe",
        serviceSessionId: nextGivingServiceSessionId(),
        campaignId: null,
        stripeCheckoutSessionId: csId,
        stripePaymentIntentId: "pi_test_dev_low_attendance_old",
        stripeCustomerId: `cus_test_dev_low_attendance_${lowAttendance.id}`,
        paymentStatus: "succeeded",
        taxDeductible: true,
        receiptIssued: true,
      });
      donationCount++;
    }
  }

  // 25 recurring monthly tithe plans
  for (let ri = 0; ri < recurringMembers.length; ri++) {
    const member = recurringMembers[ri];
    const subId = `sub_test_dev_${ri}_${member.id}`;
    const cusId = `cus_test_dev_${ri}_${member.id}`;
    const amountCents = seededInt(ri + 300, 5000, 80000);
    const status = "active" as const;

    const existing = await db
      .select({ id: schema.recurringDonationsTable.id })
      .from(schema.recurringDonationsTable)
      .where(eq(schema.recurringDonationsTable.stripeSubscriptionId, subId));

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

      // Corresponding donation record for this recurring plan
      const csId2 = `cs_test_dev_recurring_${ri}_${member.id}`;
      const existingDon = await db
        .select({ id: schema.donationsTable.id })
        .from(schema.donationsTable)
        .where(eq(schema.donationsTable.stripeCheckoutSessionId, csId2));

      if (!existingDon[0]) {
        const donationDate = new Date(Date.now() - 30 * 24 * 3600_000);
        await db.insert(schema.donationsTable).values({
          churchId: church.id,
          memberId: member.id,
          donorName: `${member.firstName} ${member.lastName}`,
          donorEmail: member.email,
          amountCents,
          donationDate,
          donationType: "recurring",
          givingCategory: "tithe",
          serviceSessionId: nextGivingServiceSessionId(),
          campaignId: null,
          stripeCheckoutSessionId: csId2,
          stripePaymentIntentId: `pi_test_dev_recurring_${ri}_${member.id}`,
          stripeSubscriptionId: subId,
          stripeCustomerId: cusId,
          stripeReceiptUrl: `https://pay.stripe.com/receipts/test_pi_test_dev_recurring_${ri}_${member.id}`,
          paymentStatus: "succeeded",
          taxDeductible: true,
          receiptIssued: false,
        });
        donationCount++;
      }

      recurringCount++;
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n✅  Dev seed complete!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Church:                ${church.name}`);
  console.log(`  Total fake people:     ${allMembers.length + createdChildren.length} (${allMembers.length} users + ${createdChildren.length} children)`);
  console.log(`  Household members:     ${householdMemberCount} (in 45 household groups)`);
  console.log(`  Unaffiliated members:  ${unaffiliatedCount}`);
  console.log(`  Test accounts:         7 (superadmin@, admin1@–admin5@, member@)`);
  console.log(`  Members:               ${activeMembers.length}`);
  console.log(`  Low-attendance tests:  ${lowAttendanceMembers.length}`);
  console.log(`  Visitors:              ${visitors.length}`);
  console.log(`  Serving members:       ${servingMembers.length}`);
  console.log(`  Discipleship members:  ${discipleshipMembers.length}`);
  console.log(`  Children (table):      ${createdChildren.length} (2–12 yrs)`);
  console.log(`  Attendance sessions:   ${allCreatedSessions.length + discipleshipSessions.length} (${sundaySessions.length} Sundays, ${discipleshipSessions.length} discipleship)`);
  console.log(`  Check-in records:      ${totalCheckins}`);
  console.log(`  Donations:             ${donationCount}`);
  console.log(`  Recurring plans:       ${recurringCount}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\nEdge cases included:");
  console.log("  • Member with no DOB (Helen Adams)");
  console.log("  • Visitor with minimal contact info");
  console.log("  • Low-attendance member with old attendance record");
  console.log("  • Child missing checkout (2 unresolved check-ins on last Sunday)");
  console.log("  • Single-parent households (Wilson, Thomas) — child has 1 guardian");
  console.log("  • Emergency-only secondary guardian (Moore/Adams households)");
  console.log("  • Household with no children (Davis, Taylor families)");
  console.log("  • Visitor one-time donation");
  console.log("  • Friday discipleship sessions crossing midnight");
  console.log("  • Giving data uses succeeded transactions only");
  console.log("\nTest credentials (dev only — Clerk auth bypassed):");
  console.log("  superadmin@churchos.test  SuperAdmin123! — super admin");
  console.log("  admin1@churchos.test      Admin123!      — admin");
  console.log("  admin2@churchos.test      Admin123!      — admin");
  console.log("  admin3@churchos.test      Admin123!      — admin");
  console.log("  admin4@churchos.test      Admin123!      — admin");
  console.log("  admin5@churchos.test      Admin123!      — admin");
  console.log("  member@churchos.test      Member123!     — member");
  console.log("\n⚠️   These credentials only work in development mode.");
}

seedDev()
  .then(() => pool.end())
  .catch((error) => {
    console.error("Seed failed:", error);
    void pool.end();
    process.exit(1);
  });
