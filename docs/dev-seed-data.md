# Dev Seed Data

> Warning: this dataset is for development and QA only. It must never run in production, must not overwrite production data, and must not use real people or payment data.

## Purpose

`npm run seed:dev` creates a realistic medium-sized church dataset for Church OS so dashboards, permissions, attendance, discipleship, children check-in, giving, serving teams, household relationships, and edge cases can be tested with durable database records.

The seed intentionally does not classify members with hardcoded `active` or `inactive` status. Engagement should be derived from attendance, serving, giving, and participation history.

## How To Run

Set `DATABASE_URL` first, then run:

```bash
npm run seed:dev
```

The root script calls the base seed and then rebuilds the dev dataset with reset behavior:

```bash
pnpm --filter @workspace/scripts run seed
pnpm --filter @workspace/scripts run seed:dev -- --reset
```

Production safety:

- `server/src/db/seed.dev.js` refuses to run when `NODE_ENV=production`.
- `scripts/src/seed.dev.ts` also refuses to run when `NODE_ENV=production`.
- The production refusal message is: `Refusing to seed dev data in production.`

## Expected Dataset

The current data model stores adults, teens, admins, and login-capable members in `users`, while children are stored in `children`.

Expected counts:

- 1 church: `CJC International`
- 200 total fake people: 165 `users` plus 35 `children`
- 45 household groups
- 35 children ages 2-12
- 20 teens ages 13-17
- 105 adults ages 18-59
- 40 seniors ages 60+
- About 55 serving members
- About 30 discipleship participants
- 48 regular service attendance sessions
- 12 Friday discipleship sessions
- 18-30 children check-ins per Sunday
- 60+ donors with giving records
- 25 recurring tithe plans
- 150-300 successful donation transactions

## Test Credentials

| Email | Password | Role |
| --- | --- | --- |
| `superadmin@churchos.test` | `SuperAdmin123!` | `super_admin` |
| `admin1@churchos.test` | `Admin123!` | `admin` |
| `admin2@churchos.test` | `Admin123!` | `admin` |
| `admin3@churchos.test` | `Admin123!` | `admin` |
| `admin4@churchos.test` | `Admin123!` | `admin` |
| `admin5@churchos.test` | `Admin123!` | `admin` |
| `member@churchos.test` | `Member123!` | `member` |

Passwords are hashed before storage.

## Admin Model

There are only two seeded admin types:

- `super_admin`: unrestricted access, permission management, admin management, settings, and all dashboards/modules.
- `admin`: operational admin with permissions that can be configured later.

The seed does not create `finance_admin`, `attendance_lead`, `children_ministry`, `minister`, or `pastor` admin types. Operational differences should come from permissions, not hardcoded role labels.

## Member Engagement

Do not use `active` or `inactive` as seeded member status categories.

The dataset includes:

- visitors
- new members
- regular attendees
- occasional attendees
- members with little or no recent attendance
- members with older attendance/giving history

Active Member logic should be tested through derived behavior, such as serving in a department or attending more than 50% of regular services in a month.

## Serving Teams

Serving is modeled as member data, not as a separate ministry-leader role.

Seeded serving teams include:

- Children Ministry
- Worship Team
- Media & Tech
- Hospitality
- Prayer Team
- Outreach
- Security
- Ushers
- Discipleship

Some admins are also serving members.

## Attendance And Discipleship

Regular service sessions cover 12 weeks:

- Thursday Service
- Friday Service
- Saturday Service
- Sunday Service

Discipleship uses the same attendance system:

- Service/session type: `discipleship`
- Friday nights
- 11:00 PM to 1:00 AM Saturday
- Crosses midnight
- About 30 recurring participants

This supports testing attendance by service, attendance by service type, discipleship calculations, trends, and cross-midnight logic.

## Children Check-In

Children check-in records are generated for Sunday services only.

The dataset includes:

- Toddlers, Preschool, and Elementary classroom assignments
- authorized guardian links
- realistic check-in and checkout times
- one unresolved checkout edge case
- one historical duplicate check-in edge case that is already checked out

There should be no duplicate active check-ins.

## Giving

Allowed giving categories:

- Tithe
- Gift/Offering
- Building Fund

The seed creates only successful transactions. It does not generate failed or pending donations.

Fake Stripe-style IDs are used:

- `cus_test_...`
- `pi_test_...`
- `sub_test_...`
- `cs_test_...`

No Stripe APIs are called.

## QA Edge Cases

Included edge cases:

- missing DOB
- missing phone number
- member without household
- household without children
- duplicate email prevention through upsert/reset behavior
- unresolved child checkout
- historical duplicate child check-in record
- cross-midnight discipleship sessions
- visitor with incomplete contact info
- very high giving record
- very low attendance member
- member serving in a ministry

Removed edge cases:

- failed donations
- pending donations
- inactive member status testing
- hardcoded finance/attendance/children admin role types

## Dashboard Support

The dataset supports:

- attendance by service
- attendance by service type
- discipleship attendance
- giving totals
- giving totals by Tithe, Gift/Offering, and Building Fund
- recurring tithe counts
- serving team counts
- household counts
- children check-in counts
- unresolved check-ins
- attendance trends
- top givers
- role visibility
- permission-gated dashboards

## Replit Notes

Use this only against a Replit development database. Before running, confirm:

- `NODE_ENV` is not `production`
- `DATABASE_URL` points to the dev database
- you are comfortable resetting existing dev seed data

After running the seed, log in with the demo buttons or test credentials and verify the admin dashboard, members directory, attendance, children ministry, giving, settings, and member profile views.
