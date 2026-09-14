# moval-living — Deals: image + admin-add-on-behalf

**Date:** 2026-09-14
**Owner:** Johnny
**Approved by Johnny:** 2026-09-14 (recommended path: promote `Deal` to first-class model, deprecate `Business.coupon` Json, one card per deal on `/deals`, admin uses a Deals tab inside existing `/dashboard/edit?id=...` admin form)

## Why

The current "Deals" feature is a single `Business.coupon` JSON blob (`{ headline, description, code, expiresAt }`) — one coupon per business, no image. The Zod schema and `BusinessCard` already expose a `coupon.imageUrl` field, but no upload wiring or DB plumbing backs it; the field is dead-on-arrival. Johnny wants:

1. Businesses can attach an image to a deal.
2. Site admin can create/edit/delete deals on behalf of any business.

The first ask is impossible with a single JSON blob (no per-deal image), so the work has to expand to a proper `Deal` model.

## Decisions (already approved)

| Question | Answer |
|---|---|
| Schema | Promote `Deal` to its own table. Keep `Business.coupon` + `hasCoupon` for **one migration cycle** (no destructive drop) so legacy clients don't crash if anything still reads them. Drop in a follow-up PR after a few weeks. |
| Public page | `/deals` renders **one card per deal**. A business with 3 deals shows 3 cards. |
| Admin entry point | A **Deals tab inside the existing `/dashboard/edit?id=...` admin form**. Reuses the page the admin already uses. No new admin route. |
| Business owner entry point | A **new `/dashboard/deals` page** (client component, list + add/edit/delete). Linked from the dashboard home for owners. |

## Model

New `Deal` model:

```prisma
model Deal {
  id            String    @id @default(cuid())
  business      Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  businessId    String

  headline      String    // 1..120
  description   String?   @db.Text
  code          String?
  imageUrl      String?
  startsAt      DateTime?
  expiresAt     DateTime?
  displayOrder  Int       @default(0)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([businessId, isActive, displayOrder])
  @@index([isActive, expiresAt])
  @@index([createdAt])
}
```

`Business` gets `deals Deal[]` (back-relation).

Legacy `Business.coupon` (Json) + `Business.hasCoupon` (Bool) stay in the schema and migration for backwards compatibility. `/api/businesses/[slug]` GET and PUT continue to accept/return the legacy fields. The PUT route no longer WRITES them — instead, when a payload sets `hasCoupon: true` + a coupon body, we **mirror it into the new `Deal` table** (upsert by `(businessId, headline)`) and clear the legacy fields. This is the soft migration path.

## Files

### New
- `prisma/migrations/20260914000000_add_deal_model/migration.sql` — creates `Deal` table + indexes + backfill from `Business.coupon` (one Deal per non-null coupon JSON on an APPROVED business).
- `src/app/api/deals/route.ts` — **POST** create (admin or owner). Validates body with `dealCreateSchema`. Auth: `canManageBusiness(actor, business.ownerId)`.
- `src/app/api/deals/[id]/route.ts` — **PATCH** update, **DELETE** remove. Auth same as POST.
- `src/app/dashboard/deals/page.tsx` — server entry; loads owner's business + deals; renders `<DealsManager />`.
- `src/components/business/DealsManager.tsx` — client component used by both owner page and admin tab. List + add + edit + delete + image upload.
- `src/components/business/DealForm.tsx` — small client form used by DealsManager (create + edit modes).
- `src/components/business/DealCardPublic.tsx` — the per-deal card rendered on `/deals` (replaces the `BusinessCard` on the deals index).

### Modified
- `prisma/schema.prisma` — adds `Deal` model, `Business.deals` back-relation. No destructive change to `coupon`/`hasCoupon`.
- `src/app/api/upload/route.ts` — accepts `type === 'deal'`. Stores at `businesses/{businessId}/deals/{filename}`. Returns `{ url }`. **No DB write** — caller wires the URL onto a `Deal` row in the same request.
- `src/app/api/deals/route.ts` (already exists as GET-only) — **add POST** alongside the existing GET. GET now queries `Deal` rows, not `Business.coupon`.
- `src/app/deals/page.tsx` — refactor to query `Deal` rows (one per card), include `business` for link/display, keep answer capsule + sort options.
- `src/app/api/businesses/[slug]/route.ts` — GET now also returns `deals: Deal[]`. PUT no longer writes legacy coupon; instead **mirrors** to `Deal` table (see "Legacy mirror" below).
- `src/lib/business-mutations.ts` — strip `hasCoupon` + `coupon` from `businessUpdateSchema` to a deprecated comment, OR keep them and add a `mirrorLegacyCouponToDeal(input, businessId)` helper. Prefer the latter.
- `src/components/business/EditBusinessClient.tsx` — keep the existing coupon block working as a "shortcut" for the legacy single-coupon path. Add a prominent banner pointing users at the new Deals tab/section. Don't break the form.
- `src/app/dashboard/edit/page.tsx` — when `isAdmin && id` is set, also render the `<DealsManager>` component on the same page (below the existing form, in a tabbed subview).
- `src/app/dashboard/page.tsx` — add a "Manage your deals" card for non-admin owners, linking to `/dashboard/deals`. Admin dashboard unchanged (admins use the Deals tab inside Edit).

### Unchanged (but worth noting)
- `src/components/business/BusinessCard.tsx` — already supports `coupon.imageUrl`. No edit needed; this card is no longer used on `/deals` (DealCardPublic replaces it there) but stays in use on `/business/[slug]`, `/category/[slug]`, etc.

## Legacy mirror (PUT /api/businesses/[slug])

When the legacy PUT payload contains `hasCoupon: true` + `coupon: { headline, ... }`:

1. Find existing `Deal` row for `(businessId, headline)` — if found, update it with the legacy fields (no-op if no imageUrl in legacy payload).
2. If not found, create one.
3. Clear `Business.coupon` to `JsonNull` and `Business.hasCoupon` to `false`.

This means an owner who only knows about the legacy form still ends up with a Deal row. No data loss. The legacy form's "Deal" toggle becomes a one-click shortcut.

## Routes summary

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/deals` | public | List active deals (sort, paginate) |
| POST | `/api/deals` | owner OR admin | Create a new deal |
| PATCH | `/api/deals/[id]` | owner-of-business OR admin | Update a deal |
| DELETE | `/api/deals/[id]` | owner-of-business OR admin | Remove a deal |
| POST | `/api/upload` (type=deal) | owner-of-business OR admin | Upload a deal image to Vercel Blob |
| GET | `/deals` | public | One card per deal |

## Data integrity

- Image upload is independent from deal create/update. Client pattern:
  1. If image file chosen → POST `/api/upload` with `type=deal` → get `{ url }`.
  2. Submit form with that `url` to `/api/deals` POST or PATCH.
- If user picks an image but cancels the form, the blob stays in Vercel. Acceptable — Vercel Blob has no easy per-file expiry and orphaned deals images are cheap. Add a TODO note; don't over-engineer.
- `displayOrder` defaults to 0; admin can drag-and-drop later (out of scope for this PR).
- `isActive=false` deals are excluded from the public index. Admin can flip this in the Deals tab.

## UI patterns

- **Owner `/dashboard/deals`** — same layout as `/dashboard/edit`: white header, container-max body, max-w-3xl. Top section: "Add a new deal" collapsible form. Below: vertical list of deal cards with Edit / Delete buttons. Empty state points at the form.
- **Admin Deals tab inside `/dashboard/edit?id=...`** — render the same `<DealsManager>` component, pass it the target `businessId`. Use a simple tabs strip (Details / Deals) above the existing form. If the page already has a tab system I'm missing, reuse it.
- **`/deals` public page** — grid of `<DealCardPublic>` cards. Each card shows the deal image (if any), business name, headline, code (monospaced pill), expiresAt, and a click-through to `/business/[slug]` + an anchor for the specific deal (`#deal-{id}`).
- **Answer capsule** — count the active deals, lead with the most-recently-added business name. Keep wording similar to current.

## Verification plan

1. `pnpm tsc --noEmit` — **expect to fail on this device** (typescript module unreadable here per project memory). State that caveat to Johnny.
2. `pnpm next build --webpack` — same caveat.
3. Smoke tests (manual, in order):
   - As owner: add a deal with image → check it appears on `/deals` and `/dashboard/deals`.
   - As owner: edit a deal, swap image, verify blob URL changes.
   - As owner: delete a deal, verify it's gone from `/deals`.
   - As admin: in `/dashboard/edit?id=X`, add a deal for business X (owned by someone else), verify it appears on `/deals`.
   - As anonymous: visit `/deals`, confirm one card per deal.
4. Run `pnpm prisma generate` after the migration is written so the Prisma client types include `Deal`.

## Rollback

- Migration `20260914000000_add_deal_model` is purely additive (new table + new back-relation, no drops). Reversible with `prisma migrate resolve --rolled-back`.
- New API routes (`/api/deals` POST/PATCH/DELETE) and components can be reverted by deleting their files. No destructive change to existing files.
- `Business.coupon` and `Business.hasCoupon` columns are NOT dropped in this PR — they're left in place. A follow-up PR can drop them after a few weeks of clean data.

## Out of scope

- Drag-and-drop reorder (`displayOrder` exists but no UI yet).
- Coupon code generation / uniqueness.
- Per-deal analytics (clicks, redemptions).
- Email-to-business-owner "your deal expired" cron.
- Auto-archiving expired deals (would mirror the Event.archive pattern).
