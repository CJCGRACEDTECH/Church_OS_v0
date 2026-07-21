# Threat Model

## Project Overview

Church OS is a TypeScript monorepo with a React/Vite frontend (`artifacts/church-os`) and an Express 5 API (`artifacts/api-server`) backed by PostgreSQL via Drizzle. Clerk provides production authentication and identity, while the application stores church membership, roles, permissions, giving, attendance, children check-in, settings, and admin invitations in its own database. The production trust model is multi-role (`admin` vs `member`) and the schema is also church-scoped (`churchId` appears across core domain tables), so scans must treat cross-church data isolation as a security boundary wherever shared tables exist.

The mockup sandbox artifact is development-only and should be ignored unless production reachability is demonstrated. This repl is not currently deployed, but production analysis should assume Replit-managed TLS and `NODE_ENV=production`.

## Assets

- **User accounts and identity links** — Clerk identities, `clerkUserId` links, account status, admin level, and permission assignments. Compromise enables impersonation or privilege escalation.
- **Church-member PII** — names, emails, phone numbers, birth dates, addresses, emergency contacts, ministry assignments, and profile photos stored in `users`, `children`, and guardian records.
- **Children check-in and attendance data** — active check-ins, guardians, pickup authorization, QR attendance tokens, attendance history, and follow-up data.
- **Giving and finance records** — donation history, donor identity, recurring giving state, receipt data, campaign data, Stripe identifiers, and tax-related metadata.
- **Administrative control plane** — admin invitations, admin user management, permission catalog state, church profile settings, and system settings.
- **Secrets and integrations** — Clerk keys, Stripe secrets, Resend key, database URL, and any SMS provider credentials.

## Trust Boundaries

- **Browser to API** — all client input is untrusted; the API must enforce authentication, authorization, and tenant/church scoping independently of frontend route guards.
- **Clerk to application identity boundary** — the app trusts Clerk for identity, then links that identity to a local user record in `/api/auth/me`. JIT provisioning and email-based linking are security-sensitive.
- **Authenticated to privileged boundary** — authenticated members, admins, and super admins have materially different access. Backend permission checks must be the source of truth.
- **Church to church boundary** — database tables and settings are church-scoped in much of the schema. A user or admin from one church must never be able to read or mutate data belonging to another church.
- **API to database** — the API has direct write access to all church data, so any missing filters or unsafe query construction can become full data exposure or privilege escalation.
- **API to external services** — Clerk, Stripe, Resend, and SMS/email providers are trusted integrations that require correct secret handling, webhook verification, and safe outbound requests.
- **Development to production boundary** — demo-session auth and mockup artifacts are allowed in non-production only and should be ignored unless production-reachable.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/*.ts`, `artifacts/church-os/src/App.tsx`, `artifacts/church-os/src/components/auth-context.tsx`
- **Highest-risk areas:** auth/JIT provisioning and public sign-up (`routes/auth.ts`, `middlewares/auth.ts`, `artifacts/church-os/src/App.tsx`), admin/invitation and settings control plane (`routes/admin.ts`, `routes/settings.ts`), member household/profile-derived linkage (`routes/member-household.ts`, `routes/auth.ts`), giving/payment/webhook logic (`routes/giving.ts`), attendance/check-in APIs (`routes/attendance.ts`, `routes/children-checkin.ts`), and event/church-profile URL fields rendered back into public or member-facing links (`routes/events.ts`, `routes/settings.ts`, `artifacts/church-os/src/pages/member/services.tsx`, `artifacts/church-os/src/pages/evangelism-public.tsx`)
- **Public vs authenticated vs admin:** health endpoints, public sign-up, invite acceptance, and Stripe webhook handling are public or semi-public; member routes require auth; admin and permission endpoints must enforce role, permission, and church checks server-side
- **Usually dev-only:** `artifacts/mockup-sandbox/**`, demo-session auth branches when `NODE_ENV !== production`

## Threat Categories

### Spoofing

The system relies on Clerk for identity but makes local authorization decisions from application-managed user rows. Every protected API route must require a valid Clerk-authenticated request in production and must resolve the authenticated user to the correct local account without trusting client-controlled identifiers. Public sign-up and `/api/auth/me` JIT provisioning are especially sensitive: they must not let arbitrary internet users enroll themselves into a real church tenant or bind themselves to a local account without an intended approval or membership path. Admin invitation acceptance and any identity-linking flow must prove that the caller controls the intended account, not merely knows an invite token or email, and email-based linking MUST require the identity provider to report that the email address is verified.

### Tampering

Admins can mutate membership, attendance, events, settings, campaigns, and admin permissions. The API must reject unauthorized writes, validate structured input, and ensure users can only modify records within their authorized role and church. Payment and receipt state must only be updated from trusted Stripe events or authorized admin actions.

### Information Disclosure

The application stores sensitive church-member, child, attendance, and giving data. API responses, exports, logs, and receipts must be scoped to the requesting user’s church and role, and must not expose admin control-plane data, donor records, invitation details, or child records through profile-derived heuristics such as shared address, email, or phone matches. Public onboarding flows must return uniform responses that do not confirm whether a person already exists in a church or another tenant. Secrets and invite links must never be exposed through client code or broadly accessible logs.

### Denial of Service

Public and authenticated endpoints that trigger external requests or heavier database work — especially invite acceptance, Stripe webhook handling, events/calendar expansion, attendance flows, and auth/profile synchronization — must not allow unbounded abuse. External calls should fail safely, and production-only controls must prevent dev/demo auth paths from becoming available.

### Elevation of Privilege

The most important guarantees in this codebase are server-side role enforcement, permission enforcement, and church-level data isolation. Members must not reach admin capabilities, admins must not automatically gain super-admin powers, and super admins from one church must not manage users, invitations, settings, or giving records for another church. Granular admin permissions such as directory-only, profile access, giving access, and check-in access must be enforced by the backend on every endpoint rather than assumed from UI visibility. Any missing church filter on shared tables is a potential privilege-escalation or data-exposure flaw in this architecture.
