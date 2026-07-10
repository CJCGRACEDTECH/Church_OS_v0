---
name: Church OS seed church slug
description: seed.ts CHURCH.slug must match the church slug actually used by auth/JIT provisioning, or reseeding creates a duplicate orphan church.
---

`scripts/src/seed.ts` upserts the church via `onConflictDoUpdate({ target: churchesTable.slug, ... })`. If `CHURCH.slug` doesn't match the slug already used elsewhere in the app (e.g. the `DEFAULT_SIGNUP_CHURCH_SLUG` fallback read in `auth.ts` / `public-onboarding.ts` during JIT provisioning), running the seed script inserts a brand-new second church row instead of updating the real one already holding all users/data.

**Why:** In this project the real live dev church ended up with slug `cjc-international` (created via JIT provisioning defaults), while `seed.ts` had a stale hardcoded slug (`cjc-church`). Running `pnpm seed` silently created an orphan duplicate "CJC Church" with no users, which is easy to miss since both rows share the same display name.

**How to apply:** Before adding any upsert keyed on church slug/id in seed scripts, verify `CHURCH.slug` matches `process.env.DEFAULT_SIGNUP_CHURCH_SLUG` (or query the `churches` table directly) rather than assuming the constant is correct. If you find two church rows with the same name but different slugs after seeding, that's this bug — merge/delete the orphan and align the slug constant.
