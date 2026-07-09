---
name: Household inbox admin permissions
description: Role requirements for household-inbox / connect-submission admin endpoints differ from the general member directory endpoints.
---

`GET /admin/household-requests` (and related child-link / spouse-link / connect-submission approval endpoints) require the `super_admin` role, while `GET /admin/members` only requires general admin/directory access.

**Why:** Confirmed via demo-session testing while porting the fuller Household Inbox UI — a plain `admin` demo token got a 403 on `/admin/household-requests` but succeeded on `/admin/members`.

**How to apply:** When testing or building admin UI that touches the inbox/connect-approval flow, use a `super_admin` demo session (not just `admin`), and don't assume all `/admin/*` routes share the same role requirement.
