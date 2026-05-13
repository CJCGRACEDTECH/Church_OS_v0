# Church OS

A church management platform for CJC International, powered by Church OS. Role-based auth (Admin and Member) via Clerk, placeholder dashboards, and a clean SaaS UI.

**Milestone:** Clerk auth migration complete — Google SSO live, session-based auth removed.

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
- Required env: `SESSION_SECRET` — secret for signing session cookies (legacy, may be removed)
- Required env: `CLERK_SECRET_KEY` — Clerk backend secret key
- Required env: `CLERK_PUBLISHABLE_KEY` — Clerk publishable key (backend proxy)
- Required env: `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key (frontend)

## Church / Credentials

- Church: CJC International
- Sign in via Google SSO or email (Clerk handles auth)
- Seeded users: `admin@churchos.test` and `member@churchos.test` (matched by email on first Clerk sign-in via JIT provisioning)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + wouter
- Auth: Clerk (Google SSO + email) — `clerkMiddleware` on backend, `ClerkProvider` on frontend
- API: Express 5 with Clerk proxy middleware (`clerkProxyMiddleware`)
- DB: PostgreSQL + Drizzle ORM (`clerk_user_id` column on users table for JIT linking)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## What Currently Works

- Clerk sign-in page with Google SSO and email/password
- JIT provisioning: first sign-in links Clerk identity to local DB user by email
- Admin login → `/admin` dashboard
- Member login → `/member` dashboard
- Logout → Clerk session destroyed, redirected to sign-in
- Page refresh → session preserved (Clerk JWT)
- Protected routes — unauthenticated users redirected to `/sign-in`
- Role enforcement — members can't access `/admin/*`, admins redirected to their dashboard
- All placeholder module pages render without errors (Coming Soon UI)
- `/api/health` and `/api/db-health` endpoints
- Sign-in page branded as "CJC International powered by Church OS"

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
- `lib/db/src/schema/users.ts` — users table (role: admin | member, clerk_user_id for Clerk linking)
- `artifacts/api-server/src/routes/auth.ts` — `/auth/me` (JIT provisioning) + `/auth/profile`
- `artifacts/api-server/src/routes/health.ts` — /health, /healthz, /db-health
- `artifacts/api-server/src/middlewares/auth.ts` — requireAuth (Clerk-based), requireRole middleware
- `artifacts/api-server/src/app.ts` — clerkProxyMiddleware + clerkMiddleware setup
- `artifacts/church-os/src/pages/login.tsx` — redirects to /sign-in (legacy stub)
- `artifacts/church-os/src/pages/sign-in.tsx` — Clerk SignIn component
- `artifacts/church-os/src/pages/sign-up.tsx` — Clerk SignUp component
- `artifacts/church-os/src/pages/admin-dashboard.tsx` — Admin dashboard
- `artifacts/church-os/src/pages/member-dashboard.tsx` — Member dashboard
- `artifacts/church-os/src/pages/admin/` — Admin placeholder pages
- `artifacts/church-os/src/pages/member/` — Member placeholder pages
- `artifacts/church-os/src/components/auth-context.tsx` — AuthContext + ProtectedRoute (uses Clerk useUser)
- `artifacts/church-os/src/components/AdminLayout.tsx` — Admin sidebar shell
- `artifacts/church-os/src/components/MemberLayout.tsx` — Member sidebar shell
- `artifacts/church-os/src/components/ComingSoonPage.tsx` — Reusable placeholder
- `artifacts/church-os/src/lib/roles.ts` — ROLES constants
- `artifacts/church-os/src/lib/routes.ts` — ADMIN_ROUTES, MEMBER_ROUTES
- `artifacts/church-os/src/lib/permissions.ts` — Permission map placeholder
- `artifacts/church-os/public/logo.svg` — CJC International / Church OS brand logo
- `scripts/src/seed.ts` — Demo data seed script
- `docs/developer-handoff.md` — Full team handoff notes

## Architecture Decisions

- Clerk handles all auth (sign-in, sign-up, SSO, session management). No passwords stored.
- JIT provisioning in `/api/auth/me`: on first sign-in, links Clerk identity to local DB user by matching email (`clerk_user_id` column). Creates a new member account if no match.
- Role and permissions stay in local PostgreSQL — Clerk only handles identity.
- `requireAuth` middleware: calls `getAuth(req)` (Clerk), queries local DB by `clerkUserId`, sets `req.localUserId` + `req.localUserRole`.
- `VITE_CLERK_PUBLISHABLE_KEY` must be used directly (NOT `publishableKeyFromHost`) — Replit dev hostname causes Clerk to derive wrong keys.
- Role-based routing handled at the React level via ProtectedRoute + AuthContext.
- Admin invite-accept flow: invited user must first sign in/up via Clerk with the invited email, then the backend promotes their local DB record to admin.

## User Preferences

- Sign-in page should be branded as "CJC International powered by Church OS"

## Gotchas

- After any OpenAPI spec change, always run codegen before using new types.
- `pnpm approve-builds` prompt is interactive; avoid packages with native build scripts.
- `VITE_CLERK_PUBLISHABLE_KEY` must be set directly — never use `publishableKeyFromHost`.
- Admin invite-accept POST now requires the invited user to already have a Clerk account with the matching email (no password creation path).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `docs/developer-handoff.md` for full team handoff notes and GitHub push commands
