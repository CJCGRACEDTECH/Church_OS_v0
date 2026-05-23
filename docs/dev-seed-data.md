# Dev Seed Data

> **Warning:** This seed data is for development only. The script will refuse to run in production.

## Purpose

Generates a realistic church dataset inside the `cjc-international` church so you can test the entire Church OS application with representative data — households, families, children, attendance, Sunday check-in, and giving — without needing real people or a Stripe account.

## How to Run

```bash
# First time (or after a fresh DB push)
pnpm --filter @workspace/scripts run seed        # base church + admin/member accounts
pnpm --filter @workspace/scripts run seed:dev    # full dev dataset on top

# Reseed from scratch (wipes dev data, then recreates)
pnpm --filter @workspace/scripts run seed:dev -- --reset
```

The script is idempotent — running it twice without `--reset` will upsert without creating duplicates.

## Test User Credentials

| Email | Password | Role / Access |
|-------|----------|---------------|
| `admin@churchos.test` | `Admin123!` | Super Admin — full access |
| `finance@churchos.test` | `Finance123!` | Pastor — giving & finance only |
| `attendance@churchos.test` | `Attendance123!` | Minister — attendance management |
| `children@churchos.test` | `Children123!` | Minister — children ministry & check-in |
| `member@churchos.test` | `Member123!` | Member — member portal only |

> These credentials only work in development mode. Clerk auth is bypassed via the demo-session endpoint when `NODE_ENV !== "production"`.

## Expected Record Counts

| Entity | Count | Notes |
|--------|-------|-------|
| Church | 1 | CJC International |
| Test accounts | 5 | admin, finance, attendance, children, member |
| Household groups | 25 | See breakdown below |
| Household members | ~57 | Members organized into households |
| Unaffiliated members | ~75 | Teens, adults, visitors, inactive |
| **Total users in DB** | **~137** | Including test accounts |
| Children (ages 2–12) | 20 | In `children` table, linked to guardians |
| Attendance sessions | 32 | 4 services × 8 weeks |
| Attendance records | ~1,500 | Realistic variation by day-of-week |
| Sunday check-in records | ~100 | 8 Sundays × 10–18 children |
| Giving campaigns | 2 | Building Fund, Uganda Missions |
| Donations (one-time) | ~55 | Spread over 25 donors, 8 weeks |
| Recurring plans | 10 | Monthly tithe |

## Household Structure

25 households across four categories:

| Category | Count | Description |
|----------|-------|-------------|
| Married couples with children | 11 | Shared last name, address, `maritalStatus=married` |
| Married couples without children | 2 | Davis family (older couple), Taylor family (newly married) |
| Single-parent households | 3 | Wilson (divorced mom), Thomas (divorced dad), Moore (widowed mom) |
| Single adult households | 5 | Young adults, ages 23–31 |
| Senior couple households | 3 | Robinson, Walker, Young families |
| Senior single households | 1 | Helen Adams (widowed, 78) |
| Secondary-guardian household | 1 | Jackson family (aunt has authorized pickup) |

**How households are modeled:** There is no `households` DB table. Households are represented by shared `lastName` + `streetAddress` + `maritalStatus` on the `users` table. Children are in the `children` table and linked to parents via the `parent_guardians` + `child_guardian_relationships` tables. Guardian email/phone matches the parent's user record.

## Age Distribution

| Group | Age Range | Location |
|-------|-----------|----------|
| Children | 2–12 | `children` table (not users) |
| Teens | 13–17 | `users` table (unaffiliated group) |
| Adults | 18–59 | `users` table (household + unaffiliated) |
| Seniors | 60+ | `users` table (household senior households) |

## Member Status Distribution

| Status | Count | Account Status |
|--------|-------|----------------|
| `active_member` | ~70 | `active` |
| `member` (new) | ~8 | `active` |
| `inactive` | ~12 | `disabled` |
| `visitor` | ~10 | `pending` |

## Attendance Patterns

Sessions are created for Thursday, Friday, Saturday, and Sunday going 8 weeks back.

| Service | Day | Expected Attendance |
|---------|-----|---------------------|
| Thursday Service | Thu | 35–55 |
| Friday Service | Fri | 45–70 |
| Saturday Service | Sat | 50–75 |
| Sunday Service | Sun | 75–100 |

- Frequent attenders: most active members attend most weeks
- Irregular attenders: some active members appear in only half the sessions
- Inactive members: one inactive member appears in the 2 oldest sessions (historical record edge case)
- Visitor: one visitor appears in a single Sunday session

## Sunday Children Check-In

- Only generated for Sunday sessions
- 10–18 children per Sunday
- Classroom assignment is based on age: Toddlers (2–3), Preschool (4–5), Elementary (6–12)
- All check-ins have a pickup code
- 2 children on the most recent Sunday have no checkout time (unresolved active check-ins)
- Children in single-parent households have only one guardian

## Giving Data

- 25 of the active members have donation records
- Donation amounts: $10–$1,000 per donation
- Recurring tithe amounts: $50–$200/month
- All Stripe IDs are fake test-format IDs (no real API calls):
  - `cus_test_dev_...`
  - `pi_test_dev_...`
  - `sub_test_dev_...`
  - `cs_test_dev_...`

## Edge Cases

These are intentionally included to exercise error handling and boundary conditions:

| Edge Case | Who / What |
|-----------|-----------|
| Member with no DOB | Helen Adams (senior widow) |
| Visitor with minimal contact info | 3–4 visitors have no address, phone, or DOB |
| Inactive member with old attendance | First inactive member appears in oldest 2 sessions |
| Child missing checkout | 2 children on the most recent Sunday have `status=active` |
| Single-parent: child with 1 guardian | Wilson family (2 kids), Thomas family (1 kid) |
| Emergency-only secondary guardian | Moore family — aunt is emergency_contact only, no authorized pickup |
| Household with no children | Davis family (couple, no kids), Taylor family (newly married) |
| Household with secondary guardian | Jackson family — aunt has authorized pickup |
| Visitor one-time donation | First visitor has a succeeded donation |
| Inactive member with old donation | First inactive member has a 2025 tithe record |
| Failed donation | Donor #20 has `paymentStatus=failed` |
| Pending donation | Donor #21 has `paymentStatus=pending` |
| Past-due recurring plan | Recurring plan #8 has `status=past_due` |

## Dashboard Testing

After seeding, the dashboards should show:

**Admin dashboard:**
- Total members: ~137 (including test accounts)
- Active members: ~70+
- Visitors: ~10
- Attendance trend: 4 services per week, 8 weeks of history
- Children checked in on Sundays
- Giving summary with recurring plans

**Member dashboard:**
- Greeting with name
- Upcoming services from the events calendar
- Giving summary (if the logged-in member has donations)
- Household: children linked to the member via guardians

## Resetting Data

To wipe all dev seed data and start fresh:

```bash
pnpm --filter @workspace/scripts run seed:dev -- --reset
```

This removes:
- All `@devtest.church` email users
- All `finance@`, `attendance@`, `children@` test accounts
- All attendance sessions with `qrToken` starting with `qr_dev_`
- All attendance records for the above users and sessions
- All `Dev_` prefixed children and their guardian links
- All donations and recurring plans for the above users

It does **not** remove `admin@churchos.test` or `member@churchos.test`.

## Production Safety

The script checks `NODE_ENV` at the top of the file and immediately exits with an error if it is `"production"`. It also has a second check inside `seedDev()`. Do not remove these guards.
