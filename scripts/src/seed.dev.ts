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
 *   - 5 named test users: admin@, member@, finance@, attendance@, children@
 *
 *   ─── Members ───────────────────────────────────────────────────────────────
 *   - 25 household groups (12 married couples, 3 single-parent, 5 single
 *     adults, 4 senior households, 1 secondary-guardian household)
 *   - ~57 household member records with spouse pairing + address grouping
 *   - ~48 unaffiliated member records (visitors, inactive, teens, extras)
 *   - Total ~105 generated member rows in the users table
 *
 *   ─── Children ──────────────────────────────────────────────────────────────
 *   - 20 children ages 2–12 in the children table
 *   - Each linked to 1–2 guardians (matching household parent names/emails)
 *   - Classroom assignment: Toddlers (2–3), Preschool (4–5), Elementary (6–12)
 *
 *   ─── Attendance ────────────────────────────────────────────────────────────
 *   - 32 sessions (4 services × 8 weeks)
 *   - ~1,500 attendance records with realistic patterns per day-of-week
 *
 *   ─── Check-in ──────────────────────────────────────────────────────────────
 *   - Sunday sessions only, 10–18 children per Sunday, 8 Sundays
 *   - ~100 total check-in records
 *
 *   ─── Giving ────────────────────────────────────────────────────────────────
 *   - 2 giving campaigns
 *   - 55 one-time donations across 25 donors
 *   - 10 recurring plans (monthly tithe)
 *   - Fake Stripe IDs (no real API calls)
 *
 *   ─── Edge cases ────────────────────────────────────────────────────────────
 *   - Member with no DOB
 *   - Visitor with minimal contact info
 *   - Inactive member with old attendance record
 *   - Child missing checkout (unresolved active check-in)
 *   - Child linked to one parent only (single-parent household)
 *   - Household with secondary guardian / emergency contact
 *   - Failed donation
 *   - Pending donation
 *   - Recurring plan in past_due status
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
type MemberStatus = "active_member" | "member" | "visitor" | "inactive";
type AccountStatus = "active" | "pending" | "disabled";
type AdminLevel = "super_admin" | "pastor" | "minister";
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

function makePickupCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
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
  if (ms === "inactive") return "disabled";
  if (ms === "visitor") return "pending";
  return "active";
}

// ─── Test accounts ────────────────────────────────────────────────────────────
const EXTRA_TEST_USERS: Array<{
  email: string;
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
    email: "finance@churchos.test",
    firstName: "Finance",
    lastName: "Lead",
    role: "admin",
    adminLevel: "pastor",
    accountStatus: "active",
    memberStatus: "active_member",
    assignedMinistry: "Finance",
    permissions: ["giving_summary", "giving_details", "giving_view_own", "giving_management", "giving_reports", "campaign_management"],
  },
  {
    email: "attendance@churchos.test",
    firstName: "Attendance",
    lastName: "Lead",
    role: "admin",
    adminLevel: "minister",
    accountStatus: "active",
    memberStatus: "active_member",
    assignedMinistry: "Administration",
    permissions: ["attendance_checkin", "attendance_management", "member_directory"],
  },
  {
    email: "children@churchos.test",
    firstName: "Children",
    lastName: "Lead",
    role: "admin",
    adminLevel: "minister",
    accountStatus: "active",
    memberStatus: "active_member",
    assignedMinistry: "Children Ministry",
    permissions: ["attendance_checkin", "member_directory"],
  },
];

// ─── Household blueprints ─────────────────────────────────────────────────────
//
// 25 households covering: 12 married couples, 3 single-parent, 5 single adults,
// 3 senior couples, 2 senior singles. Children are in the `children` table,
// linked to parents via parentGuardiansTable. Spouse pairs share last name,
// address, and have maritalStatus="married".
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
      { firstName: "Thomas", gender: "Male", ageYears: 42, maritalStatus: "married", memberStatus: "active_member", ministry: "Worship Team", smallGroup: "Marriage Ministry" },
      { firstName: "Grace", gender: "Female", ageYears: 39, maritalStatus: "married", memberStatus: "active_member", occupation: "Teacher", smallGroup: "Marriage Ministry" },
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
      { firstName: "Marcus", gender: "Male", ageYears: 36, maritalStatus: "married", memberStatus: "active_member", occupation: "Engineer" },
      { firstName: "Diane", gender: "Female", ageYears: 34, maritalStatus: "married", memberStatus: "active_member", ministry: "Hospitality", smallGroup: "Young Families" },
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
      { firstName: "Derek", gender: "Male", ageYears: 44, maritalStatus: "married", memberStatus: "active_member", ministry: "Ushers" },
      { firstName: "Carol", gender: "Female", ageYears: 41, maritalStatus: "married", memberStatus: "active_member", occupation: "Nurse", smallGroup: "Young Families" },
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
      { firstName: "Kevin", gender: "Male", ageYears: 31, maritalStatus: "married", memberStatus: "active_member", occupation: "IT Specialist" },
      { firstName: "Angela", gender: "Female", ageYears: 29, maritalStatus: "married", memberStatus: "active_member", smallGroup: "Young Families" },
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
      { firstName: "Anthony", gender: "Male", ageYears: 47, maritalStatus: "married", memberStatus: "active_member", occupation: "Business Owner", ministry: "Small Groups" },
      { firstName: "Sandra", gender: "Female", ageYears: 45, maritalStatus: "married", memberStatus: "active_member", ministry: "Prayer Team", smallGroup: "Marriage Ministry" },
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
      { firstName: "Carlos", gender: "Male", ageYears: 38, maritalStatus: "married", memberStatus: "active_member", ministry: "Media & Tech" },
      { firstName: "Maria", gender: "Female", ageYears: 35, maritalStatus: "married", memberStatus: "active_member", occupation: "Social Worker", smallGroup: "Young Families" },
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
      { firstName: "Brian", gender: "Male", ageYears: 40, maritalStatus: "married", memberStatus: "active_member", occupation: "Police Officer" },
      { firstName: "Tamara", gender: "Female", ageYears: 38, maritalStatus: "married", memberStatus: "active_member", ministry: "Children Ministry" },
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
      { firstName: "Raymond", gender: "Male", ageYears: 52, maritalStatus: "married", memberStatus: "active_member", ministry: "Discipleship" },
      { firstName: "Evelyn", gender: "Female", ageYears: 49, maritalStatus: "married", memberStatus: "active_member", occupation: "Accountant" },
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
      { firstName: "Miguel", gender: "Male", ageYears: 33, maritalStatus: "married", memberStatus: "active_member" },
      { firstName: "Luisa", gender: "Female", ageYears: 31, maritalStatus: "married", memberStatus: "active_member", smallGroup: "Spanish Ministry" },
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
      { firstName: "Jose", gender: "Male", ageYears: 55, maritalStatus: "married", memberStatus: "active_member", occupation: "Construction Worker" },
      { firstName: "Rosa", gender: "Female", ageYears: 51, maritalStatus: "married", memberStatus: "active_member", smallGroup: "Marriage Ministry" },
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
      { firstName: "Gregory", gender: "Male", ageYears: 43, maritalStatus: "married", memberStatus: "active_member", ministry: "Outreach" },
      { firstName: "Vanessa", gender: "Female", ageYears: 40, maritalStatus: "married", memberStatus: "active_member", occupation: "Counselor" },
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
      { firstName: "Natasha", gender: "Female", ageYears: 32, maritalStatus: "divorced", memberStatus: "active_member", occupation: "Administrative Assistant", ministry: "Hospitality" },
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
      { firstName: "Jerome", gender: "Male", ageYears: 37, maritalStatus: "divorced", memberStatus: "active_member", ministry: "Youth Ministry" },
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
      { firstName: "Gloria", gender: "Female", ageYears: 49, maritalStatus: "widowed", memberStatus: "active_member", occupation: "Teacher", ministry: "Prayer Team" },
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
      { firstName: "Daniel", gender: "Male", ageYears: 24, maritalStatus: "single", memberStatus: "active_member", smallGroup: "Young Adults", occupation: "IT Specialist" },
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
      { firstName: "Brittany", gender: "Female", ageYears: 26, maritalStatus: "single", memberStatus: "active_member", smallGroup: "Young Adults" },
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
      { firstName: "Damien", gender: "Male", ageYears: 29, maritalStatus: "single", memberStatus: "active_member", ministry: "Media & Tech" },
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
      { firstName: "Marcus", gender: "Male", ageYears: 31, maritalStatus: "single", memberStatus: "active_member", smallGroup: "Men's Fellowship" },
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
      { firstName: "Robert", gender: "Male", ageYears: 71, maritalStatus: "married", memberStatus: "active_member", smallGroup: "Senior Saints" },
      { firstName: "Margaret", gender: "Female", ageYears: 68, maritalStatus: "married", memberStatus: "active_member", smallGroup: "Senior Saints" },
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
      { firstName: "George", gender: "Male", ageYears: 74, maritalStatus: "married", memberStatus: "active_member", ministry: "Ushers" },
      { firstName: "Dorothy", gender: "Female", ageYears: 72, maritalStatus: "married", memberStatus: "active_member", smallGroup: "Senior Saints" },
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
      { firstName: "Harold", gender: "Male", ageYears: 66, maritalStatus: "married", memberStatus: "active_member" },
      { firstName: "Edna", gender: "Female", ageYears: 64, maritalStatus: "married", memberStatus: "active_member", smallGroup: "Senior Saints" },
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
      { firstName: "Helen", gender: "Female", ageYears: 78, maritalStatus: "widowed", memberStatus: "active_member", smallGroup: "Senior Saints" },
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
      { firstName: "Trevor", gender: "Male", ageYears: 45, maritalStatus: "married", memberStatus: "active_member", ministry: "Discipleship" },
      { firstName: "Cheryl", gender: "Female", ageYears: 43, maritalStatus: "married", memberStatus: "active_member", occupation: "Nurse" },
    ],
    children: [
      { firstName: "Evelyn", gender: "Female", ageYears: 8, hasSecondGuardian: true, secondGuardianIsEmergencyOnly: false },
    ],
    note: "edge: household with secondary guardian (aunt has authorized pickup)",
  },
];

// ─── Unaffiliated member distribution ─────────────────────────────────────────
// These are generated outside of household groups.
// Covers teens, extra active members, visitors, inactive members, ministry leaders.

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

  // 10 teens (ages 13-17)
  const teenFirstM = ["Jaylen", "Brandon", "Tyler", "Nathan", "Cameron", "Xavier"];
  const teenFirstF = ["Destiny", "Aaliyah", "Jasmine", "Brianna", "Taylor", "Sydney"];
  for (let i = 0; i < 10; i++) {
    members.push({
      firstName: i % 2 === 0 ? teenFirstM[i % teenFirstM.length] : teenFirstF[i % teenFirstF.length],
      lastName: pick(EXTRA_LAST, i),
      gender: (i % 2 === 0 ? "Male" : "Female") as "Male" | "Female",
      ageYears: 13 + (i % 5),
      memberStatus: "active_member" as MemberStatus,
      smallGroup: "College Group",
    });
  }

  // 30 active adults (ages 22-58)
  for (let i = 0; i < 30; i++) {
    members.push({
      firstName: i % 2 === 0 ? pick(FIRST_M, i + 50) : pick(FIRST_F, i + 50),
      lastName: pick(EXTRA_LAST, i + 10),
      gender: (i % 2 === 0 ? "Male" : "Female") as "Male" | "Female",
      ageYears: 22 + (i % 37),
      memberStatus: "active_member" as MemberStatus,
      ministry: i % 4 === 0 ? pick(MINISTRIES, i) : undefined,
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
      memberStatus: "active_member" as MemberStatus,
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
    });
  }

  // 12 inactive members
  for (let i = 0; i < 12; i++) {
    members.push({
      firstName: i % 2 === 0 ? pick(FIRST_M, i + 400) : pick(FIRST_F, i + 400),
      lastName: pick(EXTRA_LAST, i + 8),
      gender: (i % 2 === 0 ? "Male" : "Female") as "Male" | "Female",
      ageYears: 25 + i * 3,
      memberStatus: "inactive" as MemberStatus,
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

    // Wipe dev children
    const devChildren = await db
      .select({ id: schema.childrenTable.id })
      .from(schema.childrenTable)
      .where(and(eq(schema.childrenTable.churchId, church.id), like(schema.childrenTable.firstName, "Dev_%")));

    for (const child of devChildren) {
      await db.delete(schema.checkinRecordsTable).where(eq(schema.checkinRecordsTable.childId, child.id));
      await db.delete(schema.childGuardianRelationshipsTable).where(eq(schema.childGuardianRelationshipsTable.childId, child.id));
      await db.delete(schema.childrenTable).where(eq(schema.childrenTable.id, child.id));
    }

    // Wipe dev-domain guardians
    const devGuardians = await db
      .select({ id: schema.parentGuardiansTable.id })
      .from(schema.parentGuardiansTable)
      .where(like(schema.parentGuardiansTable.email, `%${DEV_EMAIL_DOMAIN}`));

    for (const g of devGuardians) {
      await db.delete(schema.childGuardianRelationshipsTable).where(eq(schema.childGuardianRelationshipsTable.guardianId, g.id));
      await db.delete(schema.parentGuardiansTable).where(eq(schema.parentGuardiansTable.id, g.id));
    }

    // Wipe dev users (keep admin@ and member@)
    const devUsers = await db
      .select({ id: schema.usersTable.id, email: schema.usersTable.email })
      .from(schema.usersTable)
      .where(like(schema.usersTable.email, `%${DEV_EMAIL_DOMAIN}`));

    const extraTestEmails = EXTRA_TEST_USERS.map((u) => u.email);
    const extraTestUsers = await db
      .select({ id: schema.usersTable.id, email: schema.usersTable.email })
      .from(schema.usersTable)
      .where(like(schema.usersTable.email, "%@churchos.test"));

    const toWipe = [
      ...devUsers,
      ...extraTestUsers.filter((u) => extraTestEmails.includes(u.email)),
    ];

    for (const u of toWipe) {
      await db.delete(schema.attendanceRecordsTable).where(eq(schema.attendanceRecordsTable.memberId, u.id));
      await db.delete(schema.donationsTable).where(eq(schema.donationsTable.memberId, u.id));
      await db.delete(schema.recurringDonationsTable).where(eq(schema.recurringDonationsTable.memberId, u.id));
      await db.delete(schema.adminPermissionsTable).where(eq(schema.adminPermissionsTable.userId, u.id));
    }
    for (const u of toWipe) {
      await db.delete(schema.usersTable).where(eq(schema.usersTable.id, u.id));
    }

    console.log("   Dev data cleared.\n");
  }

  // ── Extra test users ───────────────────────────────────────────────────────
  console.log("👤  Seeding extra test users...");
  const [adminUser] = await db
    .select({ id: schema.usersTable.id })
    .from(schema.usersTable)
    .where(eq(schema.usersTable.email, "admin@churchos.test"));

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
        servingStatus: "serving",
        baptismStatus: "baptized",
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
        u.permissions.map((permission) => ({
          userId: user.id,
          permission,
          grantedByUserId: adminUser?.id ?? user.id,
        }))
      );
    }
    console.log(`   ${user.role}/${user.adminLevel}: ${user.email}`);
  }

  // ── Household members ──────────────────────────────────────────────────────
  console.log("\n🏠  Seeding 25 household groups...");

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
  console.log("\n👥  Seeding unaffiliated members (teens, adults, visitors, inactive)...");

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
  const allMembers = await db
    .select({ id: schema.usersTable.id, email: schema.usersTable.email, memberStatus: schema.usersTable.memberStatus })
    .from(schema.usersTable)
    .where(eq(schema.usersTable.churchId, church.id));

  const activeMembers = allMembers.filter((m) => m.memberStatus === "active_member" || m.memberStatus === "member");
  const inactiveMembers = allMembers.filter((m) => m.memberStatus === "inactive");
  const visitors = allMembers.filter((m) => m.memberStatus === "visitor");

  console.log(`\n   Total members in church: ${allMembers.length}`);
  console.log(`   Active/member: ${activeMembers.length}  Inactive: ${inactiveMembers.length}  Visitors: ${visitors.length}`);

  // ── Children + guardians ───────────────────────────────────────────────────
  console.log("\n👶  Seeding 20 children with household guardian links...");

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

  // ── Attendance sessions (32: 4 services × 8 weeks) ────────────────────────
  console.log("\n📅  Seeding 32 attendance sessions (4 services × 8 weeks)...");

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
    4: [35, 55],  // Thursday
    5: [45, 70],  // Friday
    6: [50, 75],  // Saturday
    0: [75, 100], // Sunday (highest)
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

      // Edge case: inactive member appears in old sessions (first two weeks back)
      if (inactiveMembers.length > 0 && w >= 6) {
        attendees.push(inactiveMembers[0]);
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

  const sundaySessions = allCreatedSessions
    .filter((s) => s.dayOfWeek === 0)
    .sort((a, b) => a.sessionDate.getTime() - b.sessionDate.getTime());

  console.log(`   Sessions created: ${allCreatedSessions.length} (${sundaySessions.length} Sundays)`);

  // ── Children check-in (Sundays only) ──────────────────────────────────────
  console.log("\n✅  Seeding Sunday children check-in records...");

  let totalCheckins = 0;

  for (let si = 0; si < sundaySessions.length; si++) {
    const session = sundaySessions[si];
    const childCount = seededInt(si + 7, 10, 18);
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
          pickupCode: makePickupCode(),
          status: hasCheckout ? "checked_out" : "active",
        })
        .onConflictDoNothing();

      totalCheckins++;
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
      campaignName: "Uganda Missions 2026",
      description: "Support our team traveling to Kampala for outreach.",
      goalAmountCents: 4_500_000,
      startDate: new Date("2026-03-01"),
      endDate: new Date("2026-09-30"),
      status: "active" as const,
      campaignCategory: "Missions",
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
  console.log("\n💳  Seeding donations (55 one-time + 10 recurring)...");

  const GIVING_CATEGORIES = ["tithe", "offering", "building_fund", "missions", "special_campaign", "other"] as const;

  // 25 active members get donation records
  const givingMembers = shuffle(activeMembers, 42).slice(0, 25);
  const recurringMembers = givingMembers.slice(0, 10);
  const recurringAmounts = [5000, 7500, 10000, 12500, 15000, 8000, 9000, 6000, 11000, 20000];

  let donationCount = 0;
  let recurringCount = 0;

  // One-time donations spread over 8 weeks
  for (let di = 0; di < givingMembers.length; di++) {
    const donor = givingMembers[di];
    const donationsThisMember = 1 + (di % 3); // 1-3 donations per member

    for (let k = 0; k < donationsThisMember; k++) {
      const weeksAgo = k * 2 + (di % 4);
      const donationDate = new Date(Date.now() - weeksAgo * 7 * 24 * 3600_000);
      const amountCents = seededInt(di * 7 + k, 1000, 100000);
      const category = GIVING_CATEGORIES[di % GIVING_CATEGORIES.length];

      // Edge cases: failed and pending donations
      const paymentStatus = di === 20 ? "failed" : di === 21 ? "pending" : "succeeded";

      const campaignId =
        category === "building_fund"
          ? (campaignIdMap.get("Annual Building Fund 2026") ?? null)
          : category === "missions"
          ? (campaignIdMap.get("Uganda Missions 2026") ?? null)
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

  // Edge case: visitor one-time gift
  if (visitors.length > 0) {
    const visitor = visitors[0];
    const csId = `cs_test_dev_visitor_0`;
    const existing = await db
      .select({ id: schema.donationsTable.id })
      .from(schema.donationsTable)
      .where(eq(schema.donationsTable.stripeCheckoutSessionId, csId));

    if (!existing[0]) {
      await db.insert(schema.donationsTable).values({
        churchId: church.id,
        memberId: visitor.id,
        donorName: "Dev Visitor",
        donorEmail: visitor.email,
        amountCents: 2500,
        donationDate: new Date(Date.now() - 14 * 24 * 3600_000),
        donationType: "one_time",
        givingCategory: "offering",
        campaignId: null,
        stripeCheckoutSessionId: csId,
        stripePaymentIntentId: "pi_test_dev_visitor_0",
        paymentStatus: "succeeded",
        taxDeductible: true,
        receiptIssued: false,
      });
      donationCount++;
    }
  }

  // Edge case: inactive member with old donation
  if (inactiveMembers.length > 0) {
    const inactive = inactiveMembers[0];
    const csId = `cs_test_dev_inactive_old`;
    const existing = await db
      .select({ id: schema.donationsTable.id })
      .from(schema.donationsTable)
      .where(eq(schema.donationsTable.stripeCheckoutSessionId, csId));

    if (!existing[0]) {
      await db.insert(schema.donationsTable).values({
        churchId: church.id,
        memberId: inactive.id,
        donorName: "Dev Inactive Member",
        donorEmail: inactive.email,
        amountCents: 5000,
        donationDate: new Date("2025-06-15T12:00:00Z"),
        donationType: "one_time",
        givingCategory: "tithe",
        campaignId: null,
        stripeCheckoutSessionId: csId,
        stripePaymentIntentId: "pi_test_dev_inactive_old",
        paymentStatus: "succeeded",
        taxDeductible: true,
        receiptIssued: true,
      });
      donationCount++;
    }
  }

  // 10 recurring monthly tithe plans
  for (let ri = 0; ri < recurringMembers.length; ri++) {
    const member = recurringMembers[ri];
    const subId = `sub_test_dev_${ri}_${member.id}`;
    const cusId = `cus_test_dev_${ri}_${member.id}`;
    const amountCents = recurringAmounts[ri];
    const status = ri === 8 ? "past_due" : "active"; // edge case: one past_due

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

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n✅  Dev seed complete!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Church:                ${church.name}`);
  console.log(`  Total users in DB:     ${allMembers.length + EXTRA_TEST_USERS.length}`);
  console.log(`  Household members:     ${householdMemberCount} (in 25 household groups)`);
  console.log(`  Unaffiliated members:  ${unaffiliatedCount}`);
  console.log(`  Test accounts:         5 (admin@ member@ finance@ attendance@ children@)`);
  console.log(`  Active members:        ${activeMembers.length}`);
  console.log(`  Inactive members:      ${inactiveMembers.length}`);
  console.log(`  Visitors:              ${visitors.length}`);
  console.log(`  Children (table):      ${createdChildren.length} (2–12 yrs)`);
  console.log(`  Attendance sessions:   ${allCreatedSessions.length} (${sundaySessions.length} Sundays)`);
  console.log(`  Check-in records:      ${totalCheckins}`);
  console.log(`  Donations:             ${donationCount}`);
  console.log(`  Recurring plans:       ${recurringCount}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\nEdge cases included:");
  console.log("  • Member with no DOB (Helen Adams)");
  console.log("  • Visitor with minimal contact info");
  console.log("  • Inactive member with old attendance record");
  console.log("  • Child missing checkout (2 unresolved check-ins on last Sunday)");
  console.log("  • Single-parent households (Wilson, Thomas) — child has 1 guardian");
  console.log("  • Emergency-only secondary guardian (Moore/Adams households)");
  console.log("  • Household with no children (Davis, Taylor families)");
  console.log("  • Visitor one-time donation");
  console.log("  • Failed donation (member #20)");
  console.log("  • Pending donation (member #21)");
  console.log("  • Past-due recurring plan (recurring #8)");
  console.log("\nTest credentials (dev only — Clerk auth bypassed):");
  console.log("  admin@churchos.test       Admin123!   — super admin");
  console.log("  finance@churchos.test     Finance123! — finance access");
  console.log("  attendance@churchos.test  Attendance123! — attendance access");
  console.log("  children@churchos.test    Children123! — children ministry");
  console.log("  member@churchos.test      Member123!  — member only");
  console.log("\n⚠️   These credentials only work in development mode.");
}

seedDev()
  .then(() => pool.end())
  .catch((error) => {
    console.error("Seed failed:", error);
    void pool.end();
    process.exit(1);
  });
