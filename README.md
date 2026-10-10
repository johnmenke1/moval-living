# Moval Living

Community + business directory for Moreno Valley, California.

Live at **[www.moval.living](https://www.moval.living)**.

---

## What's here

**Core site**
- Free business listings (anyone can submit, admin approves)
- Featured tier: $29/mo or $199/yr — homepage placement + coupons
- Expert Partner tier: $197/mo or $997/yr — landing page, lead capture, badge, SES notification to partner
- Best Of voting — annual community awards
- Claim flow + email verification

**Stack**
- Next.js 16 (App Router) + React 19
- Drizzle ORM (node-postgres) + Postgres
- NextAuth v5 (credentials provider)
- Tailwind CSS 4
- Stripe (subscription billing)
- AWS SES Mail Manager (transactional email)
- Vercel (hosting + cron)

---

## Project layout

```
src/
├── app/                       # Next.js App Router
│   ├── api/                   # Route handlers (REST endpoints)
│   ├── admin*/                # Admin moderation (lives under /dashboard)
│   ├── partners/              # Expert Partner pages
│   │   ├── page.tsx           # /partners landing (one-per-category grid)
│   │   └── [slug]/page.tsx    # /partners/[slug] partner profile
│   ├── pricing/               # /pricing (3-tier comparison)
│   └── dashboard/             # /dashboard (owner + admin area)
│       └── partner/page.tsx   # /dashboard/partner (Expert Partner inbox)
├── components/
│   ├── partner/               # Expert Partner UI (EmbedBadge, LeadRow, Siblings)
│   ├── admin/                 # Admin moderation + diagnostics
│   └── forms/                 # Lead capture, signup, etc.
└── lib/
    ├── (see src/db/)           # Drizzle client, schema, relations
    ├── expert-partner.ts      # Slug helpers + display + category-exclusivity (GHL integration removed 2026-09)
    ├── business-mutations.ts  # Zod schemas for business updates
    ├── lead-recap.ts          # Weekly recap email generator
    └── email.ts               # SES Mail Manager SMTP helper
```

---

## Local development

```bash
# Install deps
npm install

# Set up the DB
# (Drizzle introspects schema on the fly from src/db/schema.ts; no client
# generation step required. Apply schema changes with `npx drizzle-kit push`.)
echo "DATABASE_URL must be set"

# Run the dev server
npm run dev
```

Open http://localhost:3000.

### Running tests

```bash
npm test                  # one-shot
npm test -- --watch       # watch mode
```

Uses Vitest. Tests live next to source as `*.test.ts` files.

### Type-checking

```bash
npx tsc --noEmit
```

---

## Deployment

Production deploys run via:

```bash
git push origin master && npx vercel --yes --prod
```

The push to `master` triggers a Vercel deployment automatically, but we always
follow it with an explicit `--prod` deploy because Vercel's auto-deploy webhook
has missed runs in the past.

### Database migrations

Schema lives in `src/db/schema.ts` (single source of truth) with relations in
`src/db/relations.ts`. The active database drift is applied with:

```bash
npx drizzle-kit push --verbose    # inspect the ALTERs, type 'y' to apply
```

Tests that hit a database use `npm run test:db`, which boots a throwaway
Postgres via `embedded-postgres` and applies the Drizzle schema from scratch.
No mutation against the live Neon DB happens during tests.

### Schema-migration safety notes

- **Array columns `NOT NULL`.** Five `text[]` columns are declared `NOT NULL`
  with a `DEFAULT ARRAY[]::text[]`: `Park.amenities`, `Park.photoUrls`,
  `Business.bestOfTags`, `Business.photos`, `BestOfCategory.tagHints`. These
  existed in production as nullable until Oct 2026. Before `drizzle-kit push`,
  confirm `SELECT COUNT(*) FROM "Business" WHERE "photos" IS NULL` returns 0.

- **`_prisma_migrations` table.** Drizzle's first `push` will offer to drop
  the legacy Prisma journal. Accepting that is fine — Drizzle maintains its
  own migration journal going forward.

- **Three idempotent "default rewrite" statements.** Each subsequent
  `drizzle-kit push` after the initial sync emits 3 no-op
  `ALTER COLUMN … SET DEFAULT ARRAY[]::text[]` statements (for
  `Park.amenities`, `Park.photoUrls`, `Business.bestOfTags`).
  Drizzle's introspection represents empty `text[]` defaults internally as
  `["RAY"]` (a quirk of the Postgres introspection library) and refuses to
  round-trip them. The statements are safe to re-run; they don't lock the
  table for more than a few ms. A future fix is to change those three
  columns in `src/db/schema.ts` to `default([])` instead of
  `default(sql\`ARRAY[]::text[]\`)`, but the fix itself requires a 4th
  push and ~ms-level table locks — not worth doing until we have a real
  reason to revisit these columns.

---

## Environment variables

Set in Vercel → Settings → Environment Variables for both `Production` and
`Preview`. See `docs/secret-inventory.md` (TODO) for the full list.

Highlights:

| Key | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres pooler (hosted in `us-west-2`) |
| `NEXTAUTH_SECRET`, `AUTH_SECRET` | NextAuth JWT signing |
| `STRIPE_SECRET_KEY` | Stripe API |
| `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` | Featured $29/mo + $199/yr |
| `STRIPE_PRICE_EXPERT_MONTHLY`, `STRIPE_PRICE_EXPERT_YEARLY` | Expert Partner $197/mo + $997/yr |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile (bot protection on all public email-sending forms) |
| `AWS_SES_SMTP_HOST`, `AWS_SES_SMTP_USERNAME`, `AWS_SES_SMTP_PASSWORD` | SES Mail Manager SMTP |
| `AUTH_EMAIL_FROM` | From address for transactional email |
| `CRON_SECRET` | Bearer token for `/api/cron/*` endpoints |

---

## Key operational runbooks

- **GHL integration broken?** Run `POST /api/admin/diagnostics/ghl` (admin only) to validate token + scopes.
- **Emails bouncing?** Run `POST /api/admin/diagnostics/ses` — a 535 means rotate the SMTP password on the AWS Mail Manager ingress endpoint.
- **Stripe checkout failing?** Run `POST /api/admin/diagnostics/stripe-prices` — stale price IDs report which one is wrong.
- **Need to test lead forwarding end-to-end?** Open admin → Businesses → click "Test GHL" on any Expert Partner row.

Full UI for all of the above: `/dashboard` → **Diagnostics** tab (admin only).

---

## Pricing

| Tier | Monthly | Yearly | Saves |
|---|---|---|---|
| Free | — | — | — |
| Featured | $29 | $199 | 43% |
| Expert Partner | $197 | $997 | 58% |

Expert Partner is **one per category** (Founding Partners get the gold gradient
and are locked in at the original rate).

---

## Cron jobs

| Schedule | What | Job ID |
|---|---|---|
| Mon 9am Pacific | Send weekly lead recap to each Expert Partner | `74699b023373` |

Add new jobs with `hermes cron` — see the Hermes Agent docs.

---

## License

Proprietary. © 2026 Moval Living. All rights reserved.