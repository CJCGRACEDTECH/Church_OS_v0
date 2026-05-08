# Church OS

A church management platform shell with role-based auth (Admin and Member), placeholder dashboards, and a clean SaaS UI.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port varies, proxied at /api)
- `pnpm --filter @workspace/church-os run dev` — run the frontend (port varies, proxied at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
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

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth)
- `lib/db/src/schema/churches.ts` — churches table
- `lib/db/src/schema/users.ts` — users table (with role: admin | member)
- `artifacts/api-server/src/routes/auth.ts` — login, /me, logout routes
- `artifacts/api-server/src/middlewares/auth.ts` — requireAuth, requireRole middleware
- `artifacts/api-server/src/lib/password.ts` — bcryptjs hash/verify helpers
- `artifacts/church-os/src/pages/login.tsx` — Login page
- `artifacts/church-os/src/pages/admin-dashboard.tsx` — Admin dashboard
- `artifacts/church-os/src/pages/member-dashboard.tsx` — Member dashboard
- `artifacts/church-os/src/components/auth-context.tsx` — AuthContext + ProtectedRoute

## Architecture decisions

- Session-based auth via express-session stored in PostgreSQL (connect-pg-simple), not JWT. Simpler, more secure for web.
- Sessions table (`user_sessions`) is created automatically on first API server start.
- Custom fetch has `credentials: "include"` so session cookies work across the Replit proxy.
- bcryptjs used instead of bcrypt (avoids native compilation issues in Replit's pnpm environment).
- Role-based routing is handled at the React level via ProtectedRoute + AuthContext.

## Product

Church OS is a church management app shell. Currently implemented:
- Login with role-based redirect (admin → /admin, member → /member)
- Admin dashboard with placeholder metrics and disabled nav items ("Coming Soon")
- Member dashboard with placeholder cards and disabled nav items
- Logout functionality
- Protected routes — unauthenticated users redirected to login

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, always run codegen before using new types.
- `pnpm approve-builds` prompt is interactive; avoid packages with native build scripts (use bcryptjs not bcrypt).
- The `user_sessions` table is auto-created by connect-pg-simple on first startup.
- Sessions use `sameSite: "lax"` in development and `"strict"` in production.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
