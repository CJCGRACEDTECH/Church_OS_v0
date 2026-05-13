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
| `/admin/admins` | AdminManagement | admin only; Super Admin edits |
| `/admin/invite/:token` | AdminInviteAccept | Public invite accept flow |
| `/admin/members` | AdminMembers | admin only |
| `/admin/households` | AdminHouseholds | admin only |
| `/admin/services` | AdminServices | admin only |
| `/admin/attendance` | AdminAttendance | admin only |
| `/admin/check-in` | AdminCheckIn | admin only |
| `/admin/giving` | AdminGiving | admin only |
| `/admin/reports` | AdminReports | admin only |
| `/admin/settings` | AdminSettings | admin only |
| `/member` | MemberDashboard | member only |
| `/member/profile` | MemberProfile | member only |
| `/member/household` | MemberHousehold | member only |
| `/member/give` | MemberGive | member only |
| `/member/services` | MemberServices | member only |
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

All pages under `/admin/*` (except `/admin`) and `/member/*` (except `/member`) are placeholder "Coming Soon" pages. They render without errors and display a planned sprint indicator.

---

## Next Sprint Modules

| Module | Route | Owner | Sprint |
|---|---|---|---|
| Auth + Roles | `/admin`, `/member` | Dev 1 | Done |
| Members | `/admin/members` | Dev 2 | Sprint 2 |
| Households | `/admin/households` | Dev 2 | Sprint 2 |
| Services | `/admin/services` | Dev 3 | Sprint 3 |
| Attendance | `/admin/attendance` | Dev 3 | Sprint 3 |
| Children Ministry | `/admin/check-in` | Dev 3 | Sprint 3 |
| Giving | `/admin/giving` | Lead/PM | Future |
| Reports | `/admin/reports` | Lead/PM | Future |
| Website | external | Dev 4 | Future |

---

## Domain Ownership

| Domain | Owner |
|---|---|
| Auth + Roles | Dev 1 |
| Members + Households | Dev 2 |
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
- Super Admins manage admins and invitations at `/admin/admins`.
- Admin invitations are stored in `admin_invitations`. Raw invite tokens are never stored; the API stores a SHA-256 token hash, enforces expiration, and marks accepted invites as single-use.
- Children Ministry v0 intentionally avoids household/family-tree modeling. It uses `children`, `parent_guardians`, `child_guardian_relationships`, and `checkin_records`.
- Check-in APIs require the `attendance_checkin` permission, and check-out validates authorized pickup contacts on the backend.
- Replit Secrets should hold all provider secrets and redirect URIs. Do not commit provider credentials.

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

### Manual Validation Checklist

1. `POST /api/auth/signup` with a new email returns `201` and `role = member`.
2. `POST /api/auth/login` with seeded member/admin credentials returns `200`.
3. A signed-in member gets `403` from `GET /api/admin/access-check`.
4. A signed-in admin gets `200` from `GET /api/admin/access-check`.
5. Google OAuth buttons only appear when Google env vars are present; callback should create or reuse a member profile.
6. Apple OAuth buttons only appear when Apple env vars are present; callback should create or reuse a member profile after provider setup is complete.
7. `PATCH /api/auth/profile` persists account, personal, emergency contact, and address fields.
8. `POST /api/auth/change-password` rejects OAuth-only accounts and succeeds for password-enabled members.
9. A `minister` admin does not see Giving, Reports, or Settings in the admin navigation.
10. Backend permission probes deny Minister access to giving records and role management while allowing Super Admin access.
11. A Super Admin can update another admin's permissions with `PATCH /api/admin/users/:id/permissions`.
12. Minister and Pastor admins receive `403` when attempting permission updates or admin invites.
13. A Super Admin can create an invite at `/admin/admins`; the invite appears in the invitations table.
14. `/admin/invite/:token` rejects expired, invalid, or already accepted invite links.
15. Accepting a valid invite creates/promotes the user as admin with the assigned permissions.
16. Register a child at `/admin/check-in` and confirm the child appears in the list.
17. Add parent/guardian contacts and verify authorized pickup status is visible.
18. Check a child in and confirm active check-in status plus pickup code.
19. Attempt checkout with an unauthorized pickup contact and confirm the backend returns `403`.
20. Check out with an authorized pickup contact and confirm the active check-in clears.
