# Setting Up Church OS on a New Computer

The repo carries all the code, but **secrets and the local database do not travel with git**.
Follow these steps on any new machine (written for macOS; adjust installs for other systems).

## 1. Install the tools

```bash
brew install postgresql@17 node@22 gh
brew services start postgresql@17
brew link --overwrite node@22
corepack enable && corepack prepare pnpm@10.17.0 --activate
```

## 2. Clone and install

```bash
gh auth login        # browser flow, same GitHub account
git clone https://github.com/CJCGRACEDTECH/Church_OS_v0.git
cd Church_OS_v0
pnpm install
```

## 3. Recreate `.env` (the secrets file — never in git)

```bash
cp .env.example .env
```

Then fill in the values. Two ways:

- **Easiest:** securely copy the working `.env` from the previous machine
  (AirDrop or a USB drive — never email, chat, or git).
- **Or re-pull each credential:**
  - `SESSION_SECRET`: any long random string (`openssl rand -hex 32`)
  - `DATABASE_URL`: `postgresql://localhost:5432/churchos`
  - Stripe keys: dashboard.stripe.com → Developers → API keys / Webhooks
  - Clerk keys: `npm i -g clerk && clerk auth login && clerk link --app app_3IhPN5q1ORFyJkjcGQh0b5cWYxU && clerk env pull --file clerk.env`
    then copy the two values in (publishable key goes in BOTH `CLERK_PUBLISHABLE_KEY`
    and `VITE_CLERK_PUBLISHABLE_KEY`)
  - Square: developer.squareup.com → your app (Production) → Credentials + Webhooks

## 4. Create and seed the database

```bash
createdb churchos
set -a; source .env; set +a
pnpm --filter @workspace/db run push
pnpm --filter @workspace/scripts run seed
```

Then make your Google accounts able to sign in (dev database only):

```sql
-- psql -d churchos
UPDATE users SET email='cjctechgrace@gmail.com', account_status='pending' WHERE email='admin@churchos.test';
```

(`pending` lets the first Clerk sign-in auto-link the account; after signing in
once it becomes active and linked.)

## 5. Run it

Two terminals (or background the first):

```bash
set -a; source .env; set +a
pnpm --filter @workspace/api-server run dev          # API on :8080
```

```bash
set -a; source .env; set +a
PORT=5173 pnpm --filter @workspace/church-os run dev  # frontend on :5173
```

Open http://localhost:5173 and sign in with Google.

## Notes

- Local dev uses Clerk **dev-instance** keys (`pk_test`/`sk_test`) — production
  keys are domain-locked to the live site.
- The local `.env` may carry the **live** Stripe secret key: creating checkouts
  is harmless, but completing one charges a real card. Stop at the card page,
  or use Stripe test keys (`sk_test…`) locally.
- Stripe/Square webhooks cannot reach localhost. The webhook handlers accept
  unsigned events in development when the corresponding secret is left empty,
  or use `stripe listen --forward-to localhost:8080/api/giving/stripe/webhook`.
