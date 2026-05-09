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
| GET | `/api/auth/me` | Current session user |
| POST | `/api/auth/logout` | Destroy session |

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
| Sunday Check-In | `/admin/check-in` | Dev 3 | Sprint 3 |
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
# Fill in DATABASE_URL and SESSION_SECRET

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
