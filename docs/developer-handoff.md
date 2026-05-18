# Church OS — Developer Handoff

**Milestone:** Pre-Sprint 1 app shell  
**Date:** May 2026  
**Status:** Ready for first GitHub main branch push

---

## Folder Structure

```
artifacts/
  api-server/          Express 5 REST API
    src/
      app.ts           Session middleware, CORS, logging
      index.ts         Server entry point
      routes/
        auth.ts        Login, /me, logout
        health.ts      /healthz, /health, /db-health
        index.ts       Router barrel
      middlewares/
        auth.ts        requireAuth, requireRole
      lib/
        logger.ts      Pino logger singleton
        password.ts    bcryptjs hash/verify helpers

  church-os/           React + Vite frontend
    src/
      App.tsx          Route definitions (wouter)
      pages/
        login.tsx           Login page
        admin-dashboard.tsx Admin home
        member-dashboard.tsx Member home
        unauthorized.tsx    Access-denied page
        not-found.tsx       404 page
        admin/              Admin placeholder pages
          members.tsx, households.tsx, services.tsx,
          attendance.tsx, check-in.tsx, giving.tsx,
          reports.tsx, settings.tsx
        member/             Member placeholder pages
          profile.tsx, household.tsx, give.tsx,
          services.tsx, settings.tsx
      components/
        auth-context.tsx    AuthProvider, ProtectedRoute, useAuth
        AdminLayout.tsx     Full admin shell (sidebar + content)
        MemberLayout.tsx    Full member shell (sidebar + content)
        ComingSoonPage.tsx  Reusable "Coming Soon" placeholder
        StatCard.tsx        Metric card for dashboards
        EmptyState.tsx      Centered empty state with icon
        LoadingSpinner.tsx  Centered loading indicator
        ErrorMessage.tsx    Error display with optional retry
        ui/                 shadcn/ui component library
      lib/
        roles.ts        ROLES constant + Role type
        routes.ts       ADMIN_ROUTES, MEMBER_ROUTES, AUTH_ROUTES
        permissions.ts  Permission map placeholder + hasPermission()
        utils.ts        Tailwind class merge helper

lib/
  api-spec/            OpenAPI contract (source of truth for codegen)
  api-zod/             Generated Zod schemas
  api-client-react/    Generated React Query hooks (Orval)
  db/                  Drizzle ORM schema + PostgreSQL pool

scripts/
  src/seed.ts          Demo data seed script (church + admin + member)
```

---

## Current Routes

### Frontend (React / wouter)

| Path | Component | Auth |
|---|---|---|
| `/` | Login | Public |
| `/unauthorized` | Unauthorized | Public |
| `/admin` | AdminDashboard | admin only |
| `/admin/profile` | AdminProfile | admin only |
| `/admin/admins` | Redirects to `/admin/settings?section=admins` | legacy admin management path |
| `/admin/invite/:token` | AdminInviteAccept | Public invite accept flow |
| `/admin/members` | AdminMembers | admin only; requires `member_directory` from API |
| `/admin/members/:id` | AdminMembers profile view | admin only; requires `member_profiles` from API |
| `/admin/households` | Redirects to `/admin/members` | removed from v0 nav |
| `/admin/services` | AdminServices calendar/list | admin only; requires `event_management` from API |
| `/admin/services/:id` | Admin event detail | admin only; requires `event_management` from API |
| `/admin/attendance` | AdminAttendance dashboard/history | admin only; requires `attendance_management` from API |
| `/admin/attendance/:id` | Attendance session detail | admin only; requires `attendance_management` from API |
| `/attendance/check-in/:token` | QR attendance check-in | signed-in member self check-in |
| `/admin/check-in` | AdminCheckIn | admin only |
| `/admin/giving` | AdminGiving | admin only |
| `/admin/reports` | Redirects to `/admin` | removed from v0 nav |
| `/admin/settings` | AdminSettings | admin only |
| `/member` | MemberDashboard | member only |
| `/member/profile` | MemberProfile | member only |
| `/member/household` | MemberHousehold | member only |
| `/member/give` | MemberGive | member only |
| `/member/services` | MemberServices calendar/list | member only |
| `/member/services/:id` | Member event detail | member only |
| `/member/settings` | MemberSettings | member only |

### Backend (Express / `/api`)

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Service health check |
| GET | `/api/healthz` | Kubernetes-style liveness probe |
| GET | `/api/db-health` | Database connectivity check |
| POST | `/api/auth/login` | Email + password login |
| POST | `/api/auth/signup` | Create a new member account |
| GET | `/api/auth/me` | Current session user |
| POST | `/api/auth/logout` | Destroy session |
| PATCH | `/api/auth/profile` | Update authenticated member profile fields |
| POST | `/api/auth/change-password` | Change password for password-enabled accounts |
| GET | `/api/auth/oauth/config` | OAuth provider availability |
| GET | `/api/auth/oauth/google/start` | Start Google OAuth |
| GET | `/api/auth/oauth/google/callback` | Google OAuth callback |
| GET | `/api/auth/oauth/apple/start` | Start Apple OAuth |
| POST | `/api/auth/oauth/apple/callback` | Apple OAuth callback |
| GET | `/api/admin/access-check` | Admin-only backend authorization probe |
| GET | `/api/admin/permission-catalog` | Backend permission catalog and tier defaults |
| GET | `/api/admin/users` | List admin profiles with permissions |
| GET | `/api/admin/users/:id` | Get one admin profile with permissions |
| PATCH | `/api/admin/users/:id/permissions` | Super Admin-only permission update |
| POST | `/api/admin/invitations` | Super Admin-only admin invite create/send |
| GET | `/api/admin/invitations` | Super Admin-only invite table |
| GET | `/api/admin/invitations/accept/:token` | Public invite validation |
| POST | `/api/admin/invitations/accept/:token` | Public invite acceptance/account setup |
| GET | `/api/admin/checkin/children` | List children with guardians and active check-in state |
| POST | `/api/admin/checkin/children` | Register a child and optional first guardian |
| PATCH | `/api/admin/checkin/children/:childId` | Update child profile fields |
| POST | `/api/admin/checkin/children/:childId/guardians` | Add parent/guardian/emergency contact |
| POST | `/api/admin/checkin/children/:childId/check-in` | Check child in |
| POST | `/api/admin/checkin/children/:childId/check-out` | Authorized pickup check-out |
| GET | `/api/admin/members` | Permission-protected member directory with search and filters |
| GET | `/api/admin/members/:id` | Permission-protected full member profile with linked children |
| POST | `/api/admin/members` | Add a member manually; always creates `role = member` |
| PATCH | `/api/admin/members/:id` | Edit member profile fields; role/admin/giving fields are excluded |
| GET | `/api/events` | Member/admin published and cancelled event occurrences |
| GET | `/api/events/:id` | Member/admin published or cancelled event detail |
| GET | `/api/admin/events` | Admin event occurrence list including drafts |
| GET | `/api/admin/events/:id` | Admin event detail |
| POST | `/api/admin/events` | Admin create event; requires `event_management` |
| PATCH | `/api/admin/events/:id` | Admin edit event; requires `event_management` |
| DELETE | `/api/admin/events/:id` | Admin delete event; requires `event_management` |
| GET | `/api/admin/attendance/summary` | Attendance dashboard summary cards |
| GET | `/api/admin/attendance/sessions` | Attendance session history with filters |
| POST | `/api/admin/attendance/sessions` | Create regular service or discipleship session |
| GET | `/api/admin/attendance/sessions/:id` | Session detail with attendance records |
| PATCH | `/api/admin/attendance/sessions/:id` | Update attendance session |
| POST | `/api/admin/attendance/sessions/:id/records` | Manual admin attendance upsert |
| GET | `/api/admin/attendance/members` | Member lookup for manual attendance |
| GET | `/api/admin/attendance/events` | Published events for linking attendance sessions |
| GET | `/api/attendance/qr/:token` | Validate QR attendance session |
| POST | `/api/attendance/qr/:token/check-in` | Signed-in member QR self check-in |

---

## Auth Flow

1. User POSTs `{ email, password }` to `/api/auth/login`
2. Server verifies password hash with bcryptjs, creates `express-session` stored in PostgreSQL (`user_sessions` table)
3. Session cookie (`connect.sid`) is set on the response — `httpOnly`, `sameSite: lax` (dev) / `strict` (prod)
4. Frontend immediately updates React Query cache with `queryClient.setQueryData(getGetMeQueryKey(), user)` to avoid a second round-trip
5. wouter redirects to `/admin` or `/member` based on `user.role`
6. On every app load, `AuthProvider` calls `GET /api/auth/me` — if the session is still valid the user stays logged in
7. On logout, the session is destroyed server-side and the React Query cache is cleared

### ProtectedRoute behaviour

- Unauthenticated → redirect to `/`
- Wrong role (e.g. member trying to reach `/admin`) → redirect to their own dashboard
- Loading → show spinner

---

## Test Login Flow

```bash
# Admin login
curl -c /tmp/cookies.txt -X POST http://localhost:80/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@churchos.test","password":"Admin123!"}'

# Verify session
curl -b /tmp/cookies.txt http://localhost:80/api/auth/me

# Health checks
curl http://localhost:80/api/health
curl http://localhost:80/api/db-health
```

---

## Known Placeholders

Some future modules still render placeholder "Coming Soon" pages. Members Directory, Admin Profile, Settings/Admin Management, and Children Ministry are active v0 modules.

---

## Next Sprint Modules

| Module | Route | Owner | Sprint |
|---|---|---|---|
| Auth + Roles | `/admin`, `/member` | Dev 1 | Done |
| Members | `/admin/members` | Dev 2 | v0 Done |
| Services | `/admin/services`, `/member/services` | Dev 3 | v0 Done |
| Attendance | `/admin/attendance` | Dev 3 | v0 Done |
| Children Ministry | `/admin/check-in` | Dev 3 | Sprint 3 |
| Giving | `/admin/giving` | Lead/PM | Future |
| Website | external | Dev 4 | Future |

---

## Domain Ownership

| Domain | Owner |
|---|---|
| Auth + Roles | Dev 1 |
| Members Directory | Dev 2 |
| Services + Attendance + Check-In | Dev 3 |
| Giving + Dashboard | Lead / PM |
| Website | Dev 4 |

---

## Setup Instructions

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Fill in DATABASE_URL, SESSION_SECRET, DEFAULT_SIGNUP_CHURCH_SLUG, APP_BASE_URL
# Add Google/Apple OAuth secrets only when those providers are ready to test.

# 3. Push database schema
pnpm --filter @workspace/db run push

# 4. Seed demo users
pnpm --filter @workspace/scripts run seed

# 5. Start services
pnpm --filter @workspace/api-server run dev   # API at /api
pnpm --filter @workspace/church-os run dev    # Frontend at /

# 6. Reseed from scratch (wipes all users + church first)
pnpm --filter @workspace/scripts run seed:reset
```

---

## GitHub Push Commands

```bash
# Push first stable shell as main
git status
git add .
git commit -m "Initial Church OS app shell — Pre-Sprint 1 handoff"
git branch -M main
git remote add origin [REPO_URL]
git push -u origin main

# Create dev and staging branches
git checkout -b dev
git push -u origin dev

git checkout main
git checkout -b staging
git push -u origin staging
```

---

## Auth Foundation Notes

- Email/password signup creates `member` accounts only.
- `users.role` remains the source of truth for `member | admin`.
- Admin role assignment stays out of frontend forms and should come from trusted seed/database/admin tooling.
- OAuth provider identities are stored in `oauth_accounts` and linked to users by provider subject ID; first-time social sign-ins create a member profile when no matching email exists.
- Member profile editing is backed by `PATCH /api/auth/profile`; admin role is never editable from the profile form.
- Password changes are backed by `POST /api/auth/change-password` and only work for accounts with password auth enabled.
- Admin tiering uses `users.admin_level` with `minister | pastor | super_admin`. Ministers get member/attendance/check-in workflows, pastors add pastoral/prayer/follow-up and approved giving-summary context, and Super Admins get giving records, financial reports, role management, settings, and database/admin configuration.
- Admin feature permissions are stored in `admin_permissions` and enforced by backend middleware. The frontend reads permissions from `/api/auth/me` and the backend catalog; it does not grant access by hiding or showing UI alone.
- Super Admins manage admins and invitations inside `/admin/settings` under Admins and Permissions.
- Admin invitations are stored in `admin_invitations`. Raw invite tokens are never stored; the API stores a SHA-256 token hash, enforces expiration, and marks accepted invites as single-use.
- Children Ministry v0 intentionally avoids household/family-tree modeling. It uses `children`, `parent_guardians`, `child_guardian_relationships`, and `checkin_records`.
- Check-in APIs require the `attendance_checkin` permission, and check-out validates authorized pickup contacts on the backend.
- Members Directory v0 uses the existing `users` table for member profiles so signup-created accounts and manually added members stay in one profile source. Admin role assignment is not exposed from Members Directory forms.
- Member list access requires `member_directory`; full profile, add, and edit actions require `member_profiles`. These checks are enforced by backend middleware before data is returned or changed.
- Members Directory never returns giving records, donation history, or financial report data.
- Services & Events uses `events` and expands weekly recurring records into calendar/feed occurrences for v0.
- Member event APIs only return `published` and `cancelled` events; draft events remain admin-only.
- Events also support `visibility = public | admin_only`. Published admin-only events appear in admin calendars but are excluded from member APIs and member calendars.
- Admin create/edit/delete event APIs require the `event_management` permission on the backend.
- Attendance uses `attendance_sessions` and `attendance_records` and is intentionally separate from Children Ministry check-in.
- Service attendance can optionally link to `events.id` through `attendance_sessions.service_event_id`.
- Discipleship attendance uses the same sessions table with `attendance_type = discipleship` plus group, teacher/leader, lesson topic, completion status, and follow-up fields.
- Attendance management requires `attendance_management`; QR self check-in requires the signed-in member and never allows checking in another member.
- QR links use opaque random session tokens, expire by `qr_expiration`, require active sessions, and are blocked after duplicate check-ins.
- Replit Secrets should hold all provider secrets and redirect URIs. Do not commit provider credentials.

### Members Directory Database Fields

The following columns were added to `users` for church CRM member profiles:

```sql
member_status text not null default 'member',
ministry_department text,
join_date date,
baptism_status text not null default 'unknown',
small_group text,
serving_status text not null default 'not_serving',
preferred_contact_method text not null default 'email',
emergency_contact_relationship text
```

Run the normal Drizzle push in Replit after pulling this code:

```bash
pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts run seed
```

No new environment variables are required for Members Directory.

### Services & Events Database Fields

The `events` table stores one-time and recurring service/event definitions:

```sql
id serial primary key,
church_id integer not null,
title text not null,
event_type text not null default 'service',
description text,
start_datetime timestamptz not null,
end_datetime timestamptz not null,
location text,
event_mode text not null default 'in_person',
zoom_link text,
youtube_link text,
poster_url text,
is_recurring boolean not null default false,
recurrence_pattern text not null default 'one_time',
recurrence_day integer,
recurrence_time text,
visibility text not null default 'public',
status text not null default 'draft',
created_by_user_id integer,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

Default services seeded by `pnpm --filter @workspace/scripts run seed`:

- Tuesday Prayer / Bible Study: 8:00 PM on Zoom
- Thursday Service: 7:00 PM
- Friday Service: 7:00 PM
- Saturday Service: 7:00 PM
- Sunday Service: 11:00 AM

No new environment variables are required for Services & Events.

### Attendance Database Fields

```sql
attendance_sessions:
id serial primary key,
church_id integer not null,
attendance_type text not null,
service_event_id integer,
session_name text not null,
session_date timestamptz not null,
start_time text,
location text,
discipleship_group text,
teacher_leader text,
lesson_topic text,
qr_token text not null unique,
qr_enabled boolean not null default true,
qr_expiration timestamptz not null,
session_status text not null default 'upcoming',
created_by_user_id integer,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()

attendance_records:
id serial primary key,
session_id integer not null,
member_id integer not null,
attendance_status text not null default 'present',
checkin_source text not null default 'manual_admin',
checkin_time timestamptz not null default now(),
checked_in_by_user_id integer,
notes text,
completion_status text,
follow_up_needed boolean not null default false,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

Important constraint:

```sql
CREATE UNIQUE INDEX attendance_session_member_unique_idx
ON attendance_records(session_id, member_id);
```

Run after pulling in Replit:

```bash
pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts run seed
```

No new environment variables are required for Attendance.

### Creating Admin Tiers

```sql
-- Full admin access, including giving records, reports, role management, settings, and system configuration
UPDATE users
SET role = 'admin', admin_level = 'super_admin', assigned_ministry = 'Executive Leadership'
WHERE email = 'superadmin@example.com';

INSERT INTO admin_permissions (user_id, permission, granted_by_user_id)
SELECT u.id, p.permission, u.id
FROM users u
CROSS JOIN (VALUES
  ('attendance_checkin'), ('member_directory'), ('member_profiles'),
  ('event_management'), ('followup_notes'), ('pastoral_notes'),
  ('giving_summary'), ('giving_details'), ('reports'),
  ('admin_management'), ('system_settings')
) AS p(permission)
WHERE u.email = 'superadmin@example.com';

-- Pastoral ministry access without full giving transactions or role management
UPDATE users
SET role = 'admin', admin_level = 'pastor', assigned_ministry = 'Pastoral Care'
WHERE email = 'pastor@example.com';

-- Operational ministry access without giving visibility
UPDATE users
SET role = 'admin', admin_level = 'minister', assigned_ministry = 'Hospitality & Care'
WHERE email = 'minister@example.com';
```

### Replit OAuth Environment

```bash
DEFAULT_SIGNUP_CHURCH_SLUG=cjc-international
APP_BASE_URL=https://YOUR-FRONTEND-REPLIT-URL
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://YOUR-API-REPLIT-URL/api/auth/oauth/google/callback
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=
APPLE_REDIRECT_URI=https://YOUR-API-REPLIT-URL/api/auth/oauth/apple/callback
ADMIN_INVITE_TTL_HOURS=72
RESEND_API_KEY=
INVITE_EMAIL_FROM="Church OS <no-reply@example.com>"
```

If `RESEND_API_KEY` is empty, admin invite URLs are written to API server logs for local/Replit testing. Configure Resend or replace the email helper before production use.

### Giving / Stripe v0

Giving is now implemented as a Stripe-hosted Checkout foundation:

- Member page: `/member/give`
- Admin page: `/admin/giving`
- Member APIs: `/api/giving/campaigns`, `/api/giving/history`, `/api/giving/checkout`, `/api/giving/receipts/:year`
- Admin APIs: `/api/admin/giving/summary`, `/api/admin/giving/donations`, `/api/admin/giving/export.csv`, `/api/admin/giving/campaigns`
- Stripe webhook: `/api/giving/stripe/webhook`

Database tables added:

```sql
giving_campaigns
donations
recurring_donations
tax_receipts
```

Replit secrets needed for live Stripe flows:

```bash
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
APP_BASE_URL=https://YOUR-FRONTEND-REPLIT-URL
```

Optional future client-side Stripe work can use:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=
```

Stripe setup:

1. Create a Stripe account and copy the secret key into `STRIPE_SECRET_KEY`.
2. Create a webhook endpoint pointing to `https://YOUR-API-REPLIT-URL/api/giving/stripe/webhook`.
3. Subscribe the webhook to `checkout.session.completed`, `payment_intent.payment_failed`, `charge.refunded`, and `customer.subscription.deleted`.
4. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Run the DB push/migration in Replit so the four Giving tables exist.
6. Run `pnpm --filter @workspace/scripts run seed` for demo campaigns/donations, or create campaigns from `/admin/giving`.

Security notes:

- Card data is never stored in the app.
- Donation records are created as pending before redirect and marked succeeded/failed/refunded by trusted Stripe webhook events.
- Members can only read their own giving history and receipts.
- Admin giving records require `giving_management`.
- CSV export requires `giving_reports`.
- Campaign create/update requires `campaign_management`.
- Ministers do not receive Giving permissions by default.
- Tax receipts are HTML print/download views in v0; they can be saved as PDF from the browser until a server-side PDF renderer is added.

### Settings & Admin Management v0

Settings is now available at `/admin/settings` for admins with `system_settings`.

Sections included:

- General / Church Profile
- Admins
- Permissions
- Services & Events
- Attendance
- Giving
- Children Ministry
- Notifications
- Integrations
- Security
- System

Database tables added:

```sql
church_profile_settings
system_settings
```

Backend endpoints:

- `GET /api/admin/settings`
- `PATCH /api/admin/settings/church-profile`
- `PATCH /api/admin/settings/groups/:group`
- `PATCH /api/admin/users/:id`
- `DELETE /api/admin/users/:id/admin-access`
- `GET /api/admin/activity-log`

Permission enforcement:

- Settings data requires `system_settings`.
- Admin profile edits/removing admin access requires Super Admin.
- Admin invites and permission changes continue to require Super Admin.
- Giving, integrations, and security settings are additionally restricted to Super Admin on save.
- Stripe secret values are not stored or returned by the frontend settings UI. Replit Secrets remain the source for `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`; the UI only shows configured/not configured status.

Replit setup:

1. Run the database push/migration so `church_profile_settings` and `system_settings` exist.
2. Keep secrets in Replit Secrets, not in frontend code.
3. Set `RESEND_API_KEY` and `INVITE_EMAIL_FROM` if admin invitation emails should be sent instead of logged.
4. Set Stripe secrets from the Giving setup section before enabling live giving.

### Manual Validation Checklist

1. `POST /api/auth/signup` with a new email returns `201` and `role = member`.
2. `POST /api/auth/login` with seeded member/admin credentials returns `200`.
3. A signed-in member gets `403` from `GET /api/admin/access-check`.
4. A signed-in admin gets `200` from `GET /api/admin/access-check`.
5. Google OAuth buttons only appear when Google env vars are present; callback should create or reuse a member profile.
6. Apple OAuth buttons only appear when Apple env vars are present; callback should create or reuse a member profile after provider setup is complete.
7. `PATCH /api/auth/profile` persists account, personal, emergency contact, and address fields.
8. `POST /api/auth/change-password` rejects OAuth-only accounts and succeeds for password-enabled members.
9. A `minister` admin does not see Giving or Settings in the admin navigation, and Reports/Households are not shown in v0.
10. Backend permission probes deny Minister access to giving records and role management while allowing Super Admin access.
11. A Super Admin can update another admin's permissions with `PATCH /api/admin/users/:id/permissions`.
12. Minister and Pastor admins receive `403` when attempting permission updates or admin invites.
13. A Super Admin can create an invite at `/admin/settings`; the invite appears in the invitations table.
14. `/admin/invite/:token` rejects expired, invalid, or already accepted invite links.
15. Accepting a valid invite creates/promotes the user as admin with the assigned permissions.
16. Register a child at `/admin/check-in` and confirm the child appears in the list.
17. Add parent/guardian contacts and verify authorized pickup status is visible.
18. Check a child in and confirm active check-in status plus pickup code.
19. Attempt checkout with an unauthorized pickup contact and confirm the backend returns `403`.
20. Check out with an authorized pickup contact and confirm the active check-in clears.
21. As a Super Admin or admin with `member_directory`, visit `/admin/members` and confirm member rows load.
22. Search the directory by name, email, and phone.
23. Filter by member status, ministry/department, serving status, and baptism status.
24. Open `/admin/members/:id` as an admin with `member_profiles` and confirm the full profile loads.
25. Add and edit a member from `/admin/members`; confirm the record remains `role = member`.
26. Remove `member_directory` or `member_profiles` from a test admin and confirm the backend returns `403` for the corresponding routes.
27. Visit `/member/services` and confirm published recurring services appear.
28. Confirm the seeded draft event does not appear in member service/event views.
29. Confirm the seeded cancelled event appears with a Cancelled badge.
30. Visit `/admin/services` as an admin with `event_management` and create, edit, and delete a test event.
31. Remove `event_management` from a test admin and confirm `POST /api/admin/events` returns `403`.
32. Confirm the dashboard feed shows the next upcoming service/event and View Details links.
33. Confirm Zoom and YouTube links appear on event detail pages when present.
34. Add a poster image to an event and confirm the thumbnail/detail image renders.
35. Create a published event with `visibility = admin_only`; confirm `/api/admin/events` includes it and `/api/events` excludes it.
36. Create a regular service attendance session from `/admin/attendance`.
37. Create a Friday discipleship session and fill group, teacher/leader, and lesson topic.
38. Search/select a member and manually mark present, late, absent, and excused.
39. Open a session detail page and confirm the QR code and QR link display.
40. Sign in as a member and open `/attendance/check-in/:token`; confirm attendance records as `qr_self_checkin`.
41. Try the same QR check-in twice and confirm the backend returns duplicate/409.
42. Close or expire a session and confirm QR check-in returns expired/410.
43. Confirm unauthenticated users cannot create or edit attendance sessions.
44. Confirm regular service and discipleship records remain distinguishable by `attendance_type`.
45. Visit `/member/give` as a member and confirm only that member's donations and recurring gifts load.
46. Submit Give Now without Stripe secrets and confirm the setup-required message appears.
47. Add Stripe secrets in Replit and confirm one-time Checkout redirects to Stripe.
48. Create a recurring gift and confirm Stripe Checkout uses subscription mode.
49. Send a signed `checkout.session.completed` webhook and confirm the matching donation becomes `succeeded`.
50. Send `payment_intent.payment_failed` and confirm the donation becomes `failed`.
51. Confirm a signed-in member receives `403` from `/api/admin/giving/summary`.
52. Visit `/admin/giving` as a Super Admin and confirm summary cards, donation rows, campaign cards, and CSV export are visible.
53. Remove `giving_management` from a test admin and confirm admin Giving APIs return `403`.
54. Remove `campaign_management` from a test admin and confirm campaign creation returns `403`.
55. Create an active campaign and confirm it appears on `/member/give`.
56. Generate a year-end receipt at `/api/giving/receipts/2026` and confirm totals include only the signed-in member's succeeded donations.
57. Visit `/admin/settings` as a Super Admin and confirm the Settings sidebar sections load.
58. Save Church Profile fields and confirm the values persist after refresh.
59. Save Attendance settings and confirm `GET /api/admin/settings` returns the new values.
60. Confirm Giving settings show Stripe configured status without exposing secret values.
61. Edit an admin profile/status from Settings and confirm changes persist.
62. Remove admin access from a test admin and confirm they become a normal member.
63. Toggle admin permissions from Settings and confirm backend `PATCH /api/admin/users/:id/permissions` enforces Super Admin access.
64. Create an admin invite from Settings and confirm it appears in Admin Invitations.
65. Confirm a non-Super Admin with no `system_settings` receives `403` from Settings APIs.
66. Confirm sensitive settings groups (`giving`, `integrations`, `security`) reject saves unless requester is Super Admin.
