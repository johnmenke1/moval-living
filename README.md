# Moval Living

Community + business directory for Moreno Valley, California.

Live at **[www.moval.living](https://www.moval.living)**.

---

## What's here

**Core site**
- Free business listings (anyone can submit, admin approves)
- Featured tier: $29/mo or $199/yr — homepage placement + coupons
- Expert Partner tier: $197/mo or $997/yr — landing page, lead capture, badge, GHL pipeline
- Best Of voting — annual community awards
- Claim flow + email verification

**Stack**
- Next.js 16 (App Router) + React 19
- Prisma 7 + Neon Postgres
- NextAuth v5 (credentials provider)
- Tailwind CSS 4
- Stripe (subscription billing)
- GoHighLevel (lead nurturing via Companies + Contacts)
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
    ├── prisma.ts              # Prisma client singleton
    ├── expert-partner.ts      # GHL integration + slug helpers + display
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
DATABASE_URL="postgresql://..." npx prisma migrate deploy

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

The DB lives on Neon. **Never use `prisma migrate deploy`** against Neon — it
deadlocks on the advisory lock. Instead, apply migrations manually via the
`pg` driver:

```bash
psql "$DATABASE_URL" -f prisma/migrations/<name>/migration.sql
```

Or use the live unredacted `DATABASE_URL` stored in this machine's `.env`/`.env.live`.

### Migrations that touch enum types

Prisma's generated SQL for `ALTER TYPE ... ADD VALUE` won't run in the same
transaction as subsequent ALTER TABLE statements on Neon. **Apply enum changes
in their own psql invocation**, then the rest of the migration in a second.

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
| `GHL_API_KEY` | GoHighLevel Private Integration token (`pit-...`) |
| `GHL_LOCATION_ID` | GHL sub-account |
| `GHL_PIPELINE_ID`, `GHL_PIPELINE_STAGE_ID`, `GHL_WORKFLOW_ID` | Expert Partner pipeline + workflow |
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