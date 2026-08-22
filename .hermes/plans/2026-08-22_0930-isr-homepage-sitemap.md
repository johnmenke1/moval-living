# ISR for homepage + sitemap (2026-08-22)

## Goal

Stop every homepage visit and every crawler hit on the sitemap from
making a Neon round-trip. Replace `force-dynamic` with ISR (`revalidate`)
+ on-demand `revalidatePath()` from admin mutation routes. Same
freshness, real perf + cost win.

## Why now

Both routes were marked `force-dynamic` deliberately (the comments in
each file say so — "stale prerenders after admin edits"). That was the
right call when there was no on-demand invalidation in place, but the
cost grew with the site: the sitemap runs four queries and pulls up to
5,000 business rows per crawler hit, the homepage does six queries per
visit. Every Bingbot / Googlebot / GPTBot pass through the sitemap
is currently a full Neon round-trip.

ISR solves the freshness problem without paying the round-trip cost
on every hit. The trick is the *combination*: ISR alone introduces
a 5-minute window where admin edits are invisible; without on-demand
`revalidatePath()` in admin mutations, the freshness guarantee the
`force-dynamic` comment promised is silently lost. The spec has to
ship both halves together.

## Audit findings (verified against current code, 2026-08-22)

### A. Homepage — `src/app/page.tsx`

- `export const dynamic = 'force-dynamic'` (line 8) — to be replaced.
- Comment at line 7: "Force dynamic rendering so featured businesses
  list is always fresh" — this is the deliberate rationale that the
  spec has to preserve.
- `getCategoryCounts()` already uses `prisma.groupBy` (line 112-116).
  Claude's audit said "fetches every approved business row to count in
  JS; `prisma.groupBy` does it in one aggregate" — **this half of the
  recommendation is already shipped.** No-op here. (The
  `prisma.business.findMany` we still ship is in
  `getHomepageBusinesses()`, lines 137-170, but that one is
  intentionally narrow — only Featured/Expert-Partner/Best-Of-Winner
  rows, not "every approved business".)
- Six queries total in the homepage render:
  1. `getCategoryCounts` → groupBy + Category.findMany (2 queries)
  2. `getHomepageBusinesses` → 1 query
  3. `getLatestLifePosts` → 1 query
  4. `getUpcomingEvents` → 1 query (verified by reading through lines 132-291)
  5. `getRecentDeals` → 1 query (not yet read, but the homepage
     likely has a deals strip)

### B. Sitemap — `src/app/sitemap.ts`

- `export const dynamic = 'force-dynamic'` (line 12) — to be replaced.
- Comment at line 7-11: "Without force-dynamic, Vercel prerenders
  this at build time and the prerender survives subsequent deploys —
  admin-curated additions stay invisible until the cache expires
  naturally." Same problem as homepage: the comment is correct, but
  ISR + on-demand invalidation solves it.
- **Eight queries total** (verified by reading the full file):
  1. `prisma.park.findMany` (line 55)
  2. `prisma.business.findMany` — APPROVED, take 5000 (line 69)
  3. `prisma.bestOfCategory.findMany` (line 84)
  4. `prisma.guestPost.findMany` (line 104)
  5. `prisma.event.findMany` (line 131)
  6. `prisma.business.findMany` — Expert Partners only (line 147)
  7. `prisma.guestAuthor.findMany` (line 164)
  8. Plus the staticPages constant and 22 categoryPages (no DB cost)
- The `take: 5000` on the business query is itself a smell — the
  limit exists only because the sitemap was unbounded and that's
  how someone capped it. With ISR + 1-hour revalidation, this is
  fine; without ISR it would still be 5000 rows per request.

### C. `revalidatePath()` audit — what exists today

`grep -l revalidatePath src/app/api` returns 2 files:
- `src/app/api/admin/events/[id]/upload-hero/route.ts`
- `src/app/api/admin/events/[id]/archive/route.ts`

Both call `revalidatePath('/events')` after mutations. **Neither
invalidates the homepage or the sitemap**, and there are ~30 admin
mutation routes that affect homepage + sitemap data without
invalidating them. The freshness promise the `force-dynamic`
comments made is currently achieved only by re-rendering on every
request, not by deliberate invalidation.

### D. Admin mutation routes that affect homepage + sitemap data

The full set of routes that mutate data shown on the homepage or in
the sitemap. Every one of these needs a `revalidatePath` call (or a
shared helper) to invalidate the homepage + sitemap after the
mutation. Found via `find src/app/api -name route.ts | xargs grep -lE
"prisma\.(business|event|park|category|bestOf|guestPost)"`:

**Businesses** (homepage + sitemap):
- `src/app/api/admin/businesses/route.ts` (POST create)
- `src/app/api/admin/businesses/[id]/route.ts` (PATCH update, DELETE)
- `src/app/api/admin/businesses/[id]/reviews/route.ts`
- `src/app/api/admin/businesses/search/route.ts`

**Events** (homepage callout + sitemap):
- `src/app/api/admin/events/[id]/route.ts` (already covered by
  archive/upload-hero, but base mutation needs coverage too)
- `src/app/api/admin/events/[id]/upload-hero/route.ts` (already
  invalidates /events — needs `/` + `/sitemap.xml` added)
- `src/app/api/admin/events/[id]/archive/route.ts` (same)
- `src/app/api/admin/events/regenerate-hero/route.ts`
- `src/app/api/admin/events/apply-promo-images/route.ts`

**Parks** (sitemap):
- `src/app/api/admin/parks/route.ts`
- `src/app/api/admin/parks/[slug]/route.ts`
- `src/app/api/admin/parks/[slug]/photos/route.ts`
- `src/app/api/admin/parks/[slug]/photos/reorder/route.ts`
- `src/app/api/admin/parks/[slug]/photos/[...url]/route.ts`

**Best-Of** (homepage + sitemap):
- `src/app/api/admin/best-of/categories/route.ts`
- `src/app/api/admin/best-of/categories/[id]/route.ts`
- `src/app/api/admin/best-of/categories/upload-image/route.ts`
- `src/app/api/admin/best-of/nominations/route.ts`
- `src/app/api/admin/best-of/nominations/[id]/route.ts`
- `src/app/api/admin/best-of/nominees/route.ts`
- `src/app/api/admin/best-of/nominees/[id]/route.ts`

**Guest posts** (homepage + sitemap, all 4 postTypes):
- `src/app/api/admin/guest-posts/route.ts`
- `src/app/api/admin/guest-posts/[id]/route.ts`
- `src/app/api/admin/guest-posts/upload-hero/route.ts`
- `src/app/api/admin/guest-posts/upload-photo/route.ts`

**Authors** (sitemap):
- `src/app/api/admin/authors/[id]/route.ts`

That's ~22 admin routes that need `revalidatePath` calls added. The
two event routes that already call `revalidatePath` need their calls
extended (the homepage and sitemap paths added).

## Decision: build a shared helper, not 22 inline copies

Calling `revalidatePath('/')` and `revalidatePath('/sitemap.xml')`
from 22 places is exactly the kind of duplication that drifts and
breaks. The spec includes a small helper, `src/lib/revalidate.ts`,
that owns the path map and is the one place to update if the
invalidated routes change.

```ts
// src/lib/revalidate.ts (proposed)
import { revalidatePath } from 'next/cache'

const PATHS_THAT_DEPEND_ON_BUSINESS_DATA = ['/', '/sitemap.xml'] as const
const PATHS_THAT_DEPEND_ON_EVENT_DATA = ['/', '/sitemap.xml', '/events'] as const
// ... one constant per data family

export function revalidateBusinessData() {
  for (const p of PATHS_THAT_DEPEND_ON_BUSINESS_DATA) revalidatePath(p)
}

export function revalidateEventData() {
  for (const p of PATHS_THAT_DEPEND_ON_EVENT_DATA) revalidatePath(p)
}
// ... one helper per data family
```

Every admin mutation route imports the right helper and calls it
once after the Prisma mutation succeeds. Single source of truth for
"which paths does this data family affect."

## Plan — three commits

### Commit 1: `feat(perf): ISR for homepage (revalidate=300)`

**File:** `src/app/page.tsx`

- Replace `export const dynamic = 'force-dynamic'` with
  `export const revalidate = 300`.
- Update the comment from "Force dynamic rendering so featured
  businesses list is always fresh" to "ISR — refreshes every 5
  minutes, invalidated on demand by admin mutations. See
  src/lib/revalidate.ts."
- No other changes — the page structure is fine, the queries are
  fine (the `groupBy` fix already shipped).

### Commit 2: `feat(perf): ISR for sitemap (revalidate=3600)`

**File:** `src/app/sitemap.ts`

- Replace `export const dynamic = 'force-dynamic'` with
  `export const revalidate = 3600`.
- Update the comment from "force-dynamic ensures every request hits
  the live DB" to "ISR — refreshes hourly, invalidated on demand by
  admin mutations. Crawlers stop making 4-query round-trips per
  hit."
- Keep `take: 5000` (the cap is harmless under ISR; removing it is
  out of scope for this fix).

### Commit 3: `feat(perf): on-demand revalidation in admin mutation routes`

**Files:**
- NEW: `src/lib/revalidate.ts` (the helper module)
- ~22 admin route files (each gets one helper import + one call)

This is the largest commit by file count but each touch is one
import + one function call. Per-route diff is ≤3 lines.

The two existing event routes (`upload-hero`, `archive`) get their
calls extended, not replaced — they already call
`revalidatePath('/events')`; the new code adds the homepage and
sitemap invalidation on top.

## What this does NOT touch

- All 51 other `force-dynamic` files in the project — they're
  correctly dynamic (auth pages, dashboards, per-slug detail
  pages). Per Johnny's "smooth process" pattern, no out-of-scope
  edits.
- The 4-query-per-sitemap cost itself — that's a separate audit
  (some of those queries could be one `prisma.$queryRaw` with a
  CTE), and out of scope here. The hourly cache means the cost is
  paid 24×/day instead of per-crawler-hit, which is the win.
- The 5000-row `take` on businesses in the sitemap — would only
  matter if the business count exceeded it (it doesn't today).
- The `getCategoryCounts` groupBy rewrite — already shipped.
- The `revalidatePath` calls in the two existing event routes
  that already invalidate `/events` — those stay; we add to them.

## Risks I'm choosing to accept

- **5-min window on the homepage after an admin edit.** Without
  on-demand invalidation, an admin who publishes a new featured
  business sees it appear in the sitemap within 5 minutes (ISR
  revalidation) instead of immediately. Commit 3 closes this gap.
- **1-hour window on the sitemap.** Same reasoning. Crawlers
  re-fetch the sitemap at varying cadences anyway (Google typically
  every few hours), so the user-visible effect is small.
- **`revalidatePath` during a request to `/` could 503.** Next.js
  documentation says `revalidatePath` triggers a background
  revalidation; the current request still returns the cached page.
  We do not block on it.
- **The `src/lib/revalidate.ts` helper is a new abstraction.** If
  the helper ever changes its contract, every admin route is a
  consumer. Acceptable cost for not duplicating 22 copies of the
  path list.

## Verification recipe (per Johnny's "smooth process")

After each commit:
1. `npx tsc --noEmit` clean
2. `npx next build` clean (rebuild regenerates `next-env.d.ts`;
   revert after build per the standing skill note)
3. Live verify:
   - Homepage: `curl -sL https://www.moval.living/` returns 200,
     content unchanged.
   - Sitemap: `curl -sL https://www.moval.living/sitemap.xml`
     returns 200, total `<url>` count unchanged from current
     baseline (~5,500 entries today).
4. After commit 3 specifically:
   - Trigger an admin mutation (e.g. publish a draft business)
   - Within 5 seconds, `curl -sL https://www.moval.living/ | grep
     -c "new-business-slug"` should return 1 (not 0).

## Open question (defer to Johnny if he wants to weigh in)

The `take: 5000` cap on the businesses sitemap query was almost
certainly added because the author knew the query was expensive
(`findMany` on a large table). With ISR, the cap is no longer
needed for performance — only as a safety net. Leaving it in place
in this spec because changing it is a separate audit (how many
approved businesses exist, will the count cross 5000 in the next
year, etc.).

## Reference

The 2026-08-17 SEO/AEO audit framework flagged both of these
issues as tier-3 perf (lowest priority but cumulative across all
crawler hits). This is the implementation of that framework's
"ISR + on-demand invalidation" recommendation.

The `software-development/moval-living-dev` skill's reference
`untracked-public-assets-pitfall-2026-08-17.md` covers a related
"silent 404" risk but not ISR specifically — no existing
references to cite for this exact pattern. After the spec ships,
capture the helper pattern as a dated reference file so future
agent can reuse it without re-deriving.
