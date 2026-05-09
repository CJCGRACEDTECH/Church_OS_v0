# Church OS

A church management platform shell with role-based auth (Admin and Member), placeholder dashboards, and a clean SaaS UI.

**Milestone:** Pre-Sprint 1 app shell — stable, ready for GitHub main branch push.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port varies, proxied at /api)
- `pnpm --filter @workspace/church-os run dev` — run the frontend (port varies, proxied at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed demo church + users
- `pnpm --filter @workspace/scripts run seed:reset` — wipe and reseed from scratch
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `SESSION_SECRET` — secret for signing session cookies

## Test Credentials

- Admin: `admin@churchos.test` / `Admin123!`
- Member: `member@churchos.test` / `Member123!`
- Church: CJC International

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + wouter
- API: Express 5 with session-based auth (connect-pg-simple + express-session)
- DB: PostgreSQL + Drizzle ORM
- Passwords: bcryptjs (pure JS, no native compilation required)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## What Currently Works

- Admin login → `/admin` dashboard
- Member login → `/member` dashboard
- Invalid login → clear error message
- Logout → session destroyed, redirected to login
- Page refresh → session preserved (cookie + PostgreSQL session store)
- Protected routes — unauthenticated users redirected to login
- Role enforcement — members can't access `/admin/*`, admins redirected to their dashboard
- All placeholder module pages render without errors (Coming Soon UI)
- `/api/health` and `/api/db-health` endpoints

## What Is Intentionally Not Built Yet

- Members module (Sprint 2)
- Households module (Sprint 2)
- Services module (Sprint 3)
- Sunday Check-In (Sprint 3)
- Attendance tracking (Sprint 3)
- Giving / Stripe integration (future sprint)
- Reports (future sprint)
- AI features, SMS/email (future sprint)

## Where Things Live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/churches.ts` — churches table
- `lib/db/src/schema/users.ts` — users table (with role: admin | member)
- `artifacts/api-server/src/routes/auth.ts` — login, /me, logout routes
- `artifacts/api-server/src/routes/health.ts` — /health, /healthz, /db-health
- `artifacts/api-server/src/middlewares/auth.ts` — requireAuth, requireRole middleware
- `artifacts/api-server/src/lib/password.ts` — bcryptjs hash/verify helpers
- `artifacts/church-os/src/pages/login.tsx` — Login page
- `artifacts/church-os/src/pages/admin-dashboard.tsx` — Admin dashboard
- `artifacts/church-os/src/pages/member-dashboard.tsx` — Member dashboard
- `artifacts/church-os/src/pages/admin/` — Admin placeholder pages
- `artifacts/church-os/src/pages/member/` — Member placeholder pages
- `artifacts/church-os/src/components/auth-context.tsx` — AuthContext + ProtectedRoute
- `artifacts/church-os/src/components/AdminLayout.tsx` — Admin sidebar shell
- `artifacts/church-os/src/components/MemberLayout.tsx` — Member sidebar shell
- `artifacts/church-os/src/components/ComingSoonPage.tsx` — Reusable placeholder
- `artifacts/church-os/src/lib/roles.ts` — ROLES constants
- `artifacts/church-os/src/lib/routes.ts` — ADMIN_ROUTES, MEMBER_ROUTES
- `artifacts/church-os/src/lib/permissions.ts` — Permission map placeholder
- `scripts/src/seed.ts` — Demo data seed script
- `docs/developer-handoff.md` — Full team handoff notes

## Architecture Decisions

- Session-based auth via express-session stored in PostgreSQL (connect-pg-simple), not JWT. Simpler, more secure for web.
- Sessions table (`user_sessions`) is created automatically on first API server start.
- Custom fetch has `credentials: "include"` so session cookies work across the Replit proxy.
- bcryptjs used instead of bcrypt (avoids native compilation issues in Replit's pnpm environment).
- Role-based routing is handled at the React level via ProtectedRoute + AuthContext.
- `connect-pg-simple` is externalized in esbuild config — it reads `table.sql` at runtime via `__dirname` which breaks when bundled.
- After login, `queryClient.setQueryData(getGetMeQueryKey(), user)` is called immediately to hydrate the auth cache without a second round-trip.

## User Preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, always run codegen before using new types.
- `pnpm approve-builds` prompt is interactive; avoid packages with native build scripts (use bcryptjs not bcrypt).
- The `user_sessions` table is auto-created by connect-pg-simple on first startup.
- Sessions use `sameSite: "lax"` in development and `"strict"` in production.
- `connect-pg-simple` MUST remain in `build.mjs` externals — it reads `table.sql` at runtime.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `docs/developer-handoff.md` for full team handoff notes and GitHub push commands
