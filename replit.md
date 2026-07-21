# Church OS

A church management platform for CJC Church (Christ Jesus Centered), powered by Church OS. Role-based auth (Admin and Member) via Clerk, placeholder dashboards, and a clean SaaS UI.

**Milestone:** Clerk auth migration complete — Google SSO live, session-based auth removed.

**Milestone:** 12-section UI/UX redesign complete (per user spec) — sidebar branding, Giving methods page, Admin Inbox rename, Admin Dashboard, Admin Giving, Admin Attendance, Children Ministry (reusable `SearchableSelect` searchable dropdown), Members Directory (invite status tracking), Member Dashboard (household card shows real member/child count + quick-view popup), Member Request Center (renamed from Household, added prayer/meeting request types), Public Connect/Request Account forms, Settings/Permissions (removed unused duplicate admin-management page). Full workspace typecheck passes clean.

**Milestone:** Giving Phase 4 + permanent auto-alias — PayPal Checkout Orders API integration (`lib/payments/providers/paypal.ts`): intent-first order creation with `custom_id`/intent correlation, OAuth token caching, `verify-webhook-signature` API-based webhook validation (PayPal uses rotating certs, not a static HMAC secret like Stripe/Square). Venmo rides the same integration via PayPal's `payment_source.venmo` preference — there is no standalone Venmo merchant API, so "connecting Venmo" always means connecting PayPal. Member give page's payment-method picker now includes functional PayPal and Venmo buttons (in-app, not external links); `POST /giving/paypal/capture` is a return-URL fallback in case the webhook hasn't landed by the time the giver is redirected back. Config-gated on `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET`/`PAYPAL_WEBHOOK_ID` — falls back to "not connected yet" like Square. Webhook handles `PAYMENT.CAPTURE.COMPLETED`/`REFUNDED`/`DENIED` and `CUSTOMER.DISPUTE.CREATED`.

Also: linking an unmatched donation to a member (or an auto-match) now **permanently saves every identifier present on the transaction** — name, email, phone, and handle — as payment aliases in one action, not just a single opt-in alias. `lib/payments/matching.ts` gained `saveAliasesFromTx()`. Verified live: linking a Zelle gift from "Dana Whitfield" (email + phone included) to a member saved all three identifiers; a later gift from the same email under a different display name ("D. W.") auto-matched at 95%, and a third gift with only a differently-formatted phone number also auto-matched at 95% — confirming the "link once, autopilot forever" behavior works across any of the captured identifiers.

**Milestone:** Giving Phase 5 — matching engine + unmatched donations queue + payment aliases. `lib/payments/matching.ts` scores candidate transactions against saved aliases (95), member email (90), phone (85), name (70/55), plus memo/recent-amount bonuses; auto-match at >=90 confidence, else queued. `POST /admin/giving/unmatched` reports a raw external transaction (Zelle/Cash App/Venmo notification text) through the matcher. Admin Giving page gained an "Unmatched Donations" collapsible queue (link to member + save-alias / anonymous / ignore / duplicate actions, all audit-logged); member profile pages gained a "Payment Aliases" card (add/remove saved Cash App/Venmo/PayPal/Zelle identifiers). Verified live: an alias saved via the UI auto-matched a same-named Zelle report at 100% confidence, and linking a queued Cash App gift with "save alias" checked auto-matched an identical follow-up gift at 95% with no manual entry.

**Milestone:** Giving Phase 3 + reports — admin "Record Donation" dialog (member search or visitor/anonymous; cash/check, Zelle, direct Cash App/Venmo/PayPal, offline Square) writing audit-logged manual donations; Square in-person card giving via payment links (config-gated on SQUARE_ACCESS_TOKEN/SQUARE_LOCATION_ID, order reference_id = giving intent id, HMAC-verified webhook, intent-status polling in the dialog); "Monthly Report & Top Donors" section on admin giving page (month picker, totals by category/method, unique donors, top-10 donors with unattributed bucket) backed by `/admin/giving/reports/*` under the giving_reports permission (added to PERMISSION_CATALOG — it was previously stripped by normalizePermissions).

**Milestone:** Automated giving system Phases 1–2 — central giving ledger with `giving_intents` created before every provider redirect (intent id travels in Stripe metadata), generalized `donations` table (payment_method, provider_* columns, raw payload storage, idempotency unique index), new ledger tables for later phases (unmatched_donations, member_payment_aliases, import_batches, giving_audit_log), giving routes refactored into `routes/giving/` modules + `lib/payments/` provider abstraction, Stripe webhook expanded (recurring invoice cycles create one donation per billing period idempotently, session expiry, disputes), Cash App Pay via Stripe (one-time only), and an in-app Give Online form on the member give page. Admin giving table gained Method column/filter and disputed status.

**Milestone:** Evangelism public contact form now shows a polished "You're Connected" welcome page after submission — Visit Us (address + map directions), Instagram, and YouTube cards, sourced from `church_profile_settings` with safe `VITE_PUBLIC_CHURCH_*` env fallbacks. Public event endpoint returns an additive `churchProfile` field (existing fields unchanged). Seed script now upserts church profile settings.

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

- Church: CJC Church (Christ Jesus Centered)
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
- Sign-in page branded as "CJC Church powered by Church OS"
- Public `/connect` page — visitor "connect card" (contact info, prayer request, ministry interest) creates a pending, inactive member profile plus a `household_update_requests` entry for admin follow-up. Does not grant login access.
- Public `/request-account` page — lets an existing/prospective member request Church OS account access; matches by email/phone where possible and logs a `household_update_requests` entry for admin review. Does not grant login access.
- Sign-up page links to both `/connect` and `/request-account` as the "contact admin" alternatives.

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
- `artifacts/api-server/src/routes/public-onboarding.ts` — public `/api/public/connect` and `/api/public/account-request` (creates pending/inactive member records only, no auth bypass)
- `artifacts/church-os/src/pages/connect.tsx` — public Connect Card form
- `artifacts/church-os/src/pages/request-account.tsx` — public account access request form
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

- Sign-in page should be branded as "CJC Church powered by Church OS"

## Gotchas

- After any OpenAPI spec change, always run codegen before using new types.
- `pnpm approve-builds` prompt is interactive; avoid packages with native build scripts.
- `VITE_CLERK_PUBLISHABLE_KEY` must be set directly — never use `publishableKeyFromHost`.
- Admin invite-accept POST now requires the invited user to already have a Clerk account with the matching email (no password creation path).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `docs/developer-handoff.md` for full team handoff notes and GitHub push commands
