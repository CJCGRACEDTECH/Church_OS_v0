# Threat Model

## Project Overview

Church OS is a TypeScript monorepo with a React/Vite frontend (`artifacts/church-os`) and an Express 5 API (`artifacts/api-server`) backed by PostgreSQL via Drizzle. Clerk provides production authentication and identity, while the application stores church membership, roles, permissions, giving, attendance, children check-in, settings, and admin invitations in its own database. The production trust model is multi-role (`admin` vs `member`) and the schema is also church-scoped (`churchId` appears across core domain tables), so scans must treat cross-church data isolation as a security boundary wherever shared tables exist.

The mockup sandbox artifact is development-only and should be ignored unless production reachability is demonstrated. The application is actively deployed publicly at `https://cjcchurch.replit.app`, so public routes should be treated as internet-exposed. Production analysis should assume Replit-managed TLS and `NODE_ENV=production`.

## Assets

- **User accounts and identity links** — Clerk identities, `clerkUserId` links, account status, admin level, and permission assignments. Compromise enables impersonation or privilege escalation.
- **Church-member PII** — names, emails, phone numbers, birth dates, addresses, emergency contacts, ministry assignments, and profile photos stored in `users`, `children`, and guardian records.
- **Children check-in and attendance data** — active check-ins, guardians, pickup authorization, QR attendance tokens, attendance history, and follow-up data.
- **Giving and finance records** — donation history, donor identity, recurring giving state, receipt data, campaign data, Stripe identifiers, and tax-related metadata.
- **Administrative control plane** — admin invitations, admin user management, permission catalog state, church profile settings, and system settings.
- **Secrets and integrations** — Clerk keys, Stripe secrets, Resend key, database URL, and any SMS provider credentials.

## Trust Boundaries

- **Browser to API** — all client input is untrusted; the API must enforce authentication, authorization, and tenant/church scoping independently of frontend route guards.
- **Clerk to application identity boundary** — the app trusts Clerk for identity, then links that identity to a local user record in `/api/auth/me`. JIT provisioning is restricted to `pending` status accounts only: active and disabled accounts cannot be linked to new Clerk identities. **Fixed:** active-account email-match takeover is no longer possible.
- **Authenticated to privileged boundary** — authenticated members, admins, and super admins have materially different access. Backend permission checks must be the source of truth.
- **Church to church boundary** — database tables and settings are church-scoped in much of the schema. A user or admin from one church must never be able to read or mutate data belonging to another church.
- **API to database** — the API has direct write access to all church data, so any missing filters or unsafe query construction can become full data exposure or privilege escalation.
- **API to external services** — Clerk, Stripe, Resend, and SMS/email providers are trusted integrations that require correct secret handling, webhook verification, and safe outbound requests.
- **Development to production boundary** — demo-session auth and mockup artifacts are allowed in non-production only and should be ignored unless production-reachable.
- **Cross-Origin boundary** — **Fixed:** `app.ts` now uses a proper allowlist (`buildAllowedOrigins()`) derived from `REPLIT_DOMAINS` and `ALLOWED_ORIGINS` env vars, replacing the previous `origin: true` mirror-any-origin configuration.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/*.ts`, `artifacts/church-os/src/App.tsx`, `artifacts/church-os/src/components/auth-context.tsx`
- **Highest-risk areas:** auth/JIT provisioning and public sign-up (`routes/auth.ts`, `middlewares/auth.ts`), admin/invitation and settings control plane (`routes/admin.ts`, `routes/settings.ts`), giving/payment/webhook logic (`routes/giving.ts`), public onboarding forms (`routes/public-onboarding.ts` — no rate limiting), attendance/check-in APIs (`routes/attendance.ts`, `routes/children-checkin.ts`), and event/church-profile URL fields rendered back into public or member-facing links (`routes/events.ts`, `routes/settings.ts`)
- **Public vs authenticated vs admin:** health endpoints, public sign-up (`/api/public/connect`, `/api/public/account-request` — no rate limiting), public YouTube (`/api/youtube/videos`, `/api/youtube/latest`), and Stripe webhook are public or semi-public; member routes require auth; admin and permission endpoints must enforce role, permission, and church checks server-side
- **Usually dev-only:** `artifacts/mockup-sandbox/**`, demo-session auth branches when `NODE_ENV !== production`
- **Confirmed safe:** church-scoped queries across members.ts, admin.ts, member-household.ts, settings.ts, dashboard.ts, giving.ts (admin endpoints), attendance.ts, children-checkin.ts, events.ts, sermons.ts, youtube.ts (DB fallback) — all include `eq(...churchId, ...)` in WHERE clauses

## Threat Categories

### Spoofing

The system relies on Clerk for identity but makes local authorization decisions from application-managed user rows. Every protected API route must require a valid Clerk-authenticated request in production and must resolve the authenticated user to the correct local account without trusting client-controlled identifiers. Public sign-up and `/api/auth/me` JIT provisioning are especially sensitive.

**Fixed (scan 2025):** `/api/auth/me` JIT provisioning now restricts email-match linking to `pending` status accounts only. Active and disabled accounts return a 403 with a message directing the user to contact their administrator. An attacker who registers a Clerk account with a victim's email can no longer take over the victim's active account.

### Tampering

Admins can mutate membership, attendance, events, settings, campaigns, and admin permissions. The API must reject unauthorized writes, validate structured input, and ensure users can only modify records within their authorized role and church. Payment and receipt state must only be updated from trusted Stripe events or authorized admin actions.

**Fixed (scan 2025):** The Stripe webhook handler (`giving.ts`) now enforces a 5-minute timestamp tolerance window (mirroring Stripe SDK `DEFAULT_TOLERANCE=300s`). Events with a timestamp older than 5 minutes are rejected.

### Information Disclosure

The application stores sensitive church-member, child, attendance, and giving data. API responses, exports, logs, and receipts must be scoped to the requesting user's church and role.

**Fixed (scan 2025):**
- `GET /admin/invitations/accept/:token` now uses `redactEmail()` to partially mask the invitee's email (e.g., `a*****@example.com`). Remaining disclosure: first name, last name, admin level, ministry, and permissions — accessible only to a caller who holds the cryptographically-random 256-bit invite token.
- Public `/connect` and `/account-request` endpoints now use uniform response codes and bodies for same-church, cross-church, and new-visitor submissions, eliminating the cross-tenant email enumeration oracle.
- `GET /api/youtube/videos` DB fallback now scopes the `sermonsTable` query with a `churchId` filter, eliminating cross-church sermon disclosure.
- `PATCH /admin/users/:id` in `settings.ts` now explicitly excludes `passwordHash` and `clerkUserId` from the response using destructuring before returning the updated user row.

**Remaining (open):**
- `GET /admin/invitations/accept/:token` still returns invitee first name, last name, admin level, assigned ministry, and permissions list to any unauthenticated caller who holds the token. Email is now redacted. LOW severity — see vulnerability `invite-token-metadata-disclosure-002`.

### Denial of Service

Public and authenticated endpoints that trigger external requests or heavier database work must not allow unbounded abuse.

**Open:** The public onboarding endpoints (`/api/public/connect`, `/api/public/account-request`) have no rate limiting, IP throttling, or CAPTCHA. An attacker can create unlimited junk member records and flood the admin inbox. See vulnerability `public-form-no-rate-limit-001`.

The YouTube scraping endpoints (`/api/youtube/videos`, `/api/youtube/latest`) are public with no rate limit, but a 5-minute in-memory cache prevents repeated upstream YouTube fetches.

### Elevation of Privilege

The most important guarantees in this codebase are server-side role enforcement, permission enforcement, and church-level data isolation. Members must not reach admin capabilities, admins must not automatically gain super-admin powers, and super admins from one church must not manage users, invitations, settings, or giving records for another church.

**Fixed (scan 2025):** CORS no longer mirrors any `Origin` with credentials. The allowlist approach ensures credentialed requests are only accepted from known Replit deployment domains.

All currently reviewed route handlers enforce `churchId` scoping in database queries. No cross-church privilege escalation paths were found in members.ts, admin.ts, settings.ts, giving.ts, sermons.ts, attendance.ts, or children-checkin.ts.
