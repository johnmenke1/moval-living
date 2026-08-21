# Event detail page — 2026-08-21

## Goal

Give every approved event a canonical internal URL at `/events/[slug]`,
with a real Schema.org `Event` JSON-LD block in the initial HTML. This
fixes the silent AEO miss (events on `/events` currently link *off* the
site to `sourceUrl` / `shareUrl`; AI crawlers never see them as
quotable moval.living content) and gives Johnny a real shareable link
to post on social.

## Why now

- The events page redesign spec (`2026-08-16_0000-events-page-redesign.md`)
  shipped the index page work but didn't add per-event detail routes.
- Every event already has a `slug` field in the `Event` model
  (verified `prisma/schema.prisma` line 4: `slug String @unique`).
- The events index currently links *out* to `shareUrl` / `sourceUrl`
  (verified `src/app/events/page.tsx:362-371` in `getEventTarget`).
  That means a click on any event on `/events` leaves moval.living.
- A detail page keeps the user on-site and gives crawlers a stable
  canonical URL per event.

## Scope

### In scope (this commit)

- New route: `src/app/events/[slug]/page.tsx` (server component).
- `generateMetadata` that derives title/description/canonical from the
  Event row.
- `Event` JSON-LD in the initial HTML (server-rendered `<script
  type="application/ld+json">`, **not** `next/script`) with at least:
  - `@type: Event`
  - `name` (event title)
  - `description`
  - `startDate` (`startsAt`)
  - `endDate` (`endsAt` if present)
  - `eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode'`
  - `eventStatus: 'https://schema.org/EventScheduled'`
  - `location: { @type: Place, name: venueName, address: PostalAddress }`
  - `image: heroImageUrl` (if present)
  - `offers: { @type: Offer, url: ticketUrl, price: 0, priceCurrency: 'USD', availability: 'https://schema.org/InStock' }` if `isFree` or `ticketUrl` is set
- `BreadcrumbList` JSON-LD (`Home › Events › <title>`) — same pattern
  the business detail page already uses.
- A canonical link `<link rel="canonical" href="https://www.moval.living/events/{slug}">` via `alternates.canonical` in `generateMetadata`.
- `generateStaticParams` for SSG: returns the slugs of all APPROVED,
  non-archived events. Detail pages are mostly static (event
  description / hero image / dates don't change after the event is
  approved), so SSG is the right call. We can opt out of SSG for
  specific paths later if needed.
- A "Back to events" link at the top of the page.
- 404 (via `notFound()`) when the slug doesn't exist, doesn't belong to
  an APPROVED event, or the event is archived (`archivedAt != null`).

### NOT in scope (this commit)

- Editing the events index to link to `/events/[slug]` instead of
  `sourceUrl` / `shareUrl`. (See Decision A below.)
- Adding a deep-link button on the EventCard for "View on moval.living"
  while keeping the external link. (See Decision A below.)
- A related-events surface ("Other events at this venue" / "More from
  this business"). That's a follow-up.
- OG image generation for event detail pages. The hero image on the
  page is enough for the first ship; a custom OG image is a follow-up.
- Adding events to `/sitemap.xml` as detail URLs. The current sitemap
  doesn't include them either; that's a follow-up once we have traffic.

## Routing

```
GET /events/[slug] → src/app/events/[slug]/page.tsx
```

Path conflict: `src/app/events/[slug]/` is a new directory; it doesn't
collide with `src/app/events/page.tsx` (the index). No reorg needed.

## Page layout (proposed)

```
┌──────────────────────────────────────────────┐
│ ← Back to events                             │
├──────────────────────────────────────────────┤
│ [Hero image, 16:9, full-bleed]               │
│                                               │
│  [Category chip] [Language chip if es]        │
│  Title (h1, 2-3 lines)                        │
│  📅 Sat, Sep 12, 5:00 PM                     │
│  📍 Venue Name · Address                      │
│  [Get tickets]  [View original source] ← A   │
├──────────────────────────────────────────────┤
│ About this event                              │
│ <description, multi-paragraph>                │
├──────────────────────────────────────────────┤
│ Source                                        │
│ Originally posted on <source>                 │
│ <excerpt if present>                          │
└──────────────────────────────────────────────┘
```

If the event has a linked `Business` (the `businessId` field), show a
"Hosted by: <business name>" line below the address that links to
`/business/<slug>`. Server component, no extra data fetch.

If the event has a linked `Venue` (the `venueId` field), the venue's
name + address override the event's denormalized fields for display
(but we keep the event's own fields as the schema.org address — the
event's address is the official record per the model comment).

## Decisions to lock before code

### Decision A — events index: link to detail page or external source?

Today, the events index links *out* to `shareUrl` / `sourceUrl`
(`getEventTarget` in `page.tsx:362-371`). The detail page changes
this. Two options:

- **A1: Always link to `/events/[slug]` from the index.** User lands
  on a moval.living page. The "View original source" button on the
  detail page takes them off if they want tickets. Pro: keeps users
  on-site, every event gets a real AEO boost, shareable URL. Con: an
  extra click for users who just want the ticket URL.
- **A2: Keep external link on the index, add detail page in parallel.** A "More info" or "Details" affordance opens the detail page. The primary click still goes to the ticket source. Pro: doesn't change existing UX. Con: defeats most of the AEO benefit if users never reach the detail page.

**Recommended: A1.** The whole point of the AEO/SEO audit was to make
moval.living the canonical source for these events. A2 is a
half-measure. If Johnny objects, fall back to A2.

### Decision B — `shareUrl` semantics going forward

The `shareUrl` field was added in commit `3d2bf3b` ("replace
ticketsSlug with shareUrl for full URL support"). Its current use is
as a **public-events-listing primary click target** (the index page
uses it as the override for `sourceUrl`). With the detail page, this
role is shifting. Two options:

- **B1: `shareUrl` becomes the "Get tickets" button target on the detail page.** Today's behavior of overriding the index link gets removed (under A1). The detail page is the new "primary" surface; shareUrl is what you'd click to actually buy tickets.
- **B2: Leave `shareUrl` semantics alone.** The index still uses it as the click target (A2 path). The detail page is a separate surface that *also* links to it for tickets.

**Recommended: B1** if A1 wins. **Recommended: B2** if A2 wins. The
two decisions are coupled.

### Decision C — 404 vs 410 for archived events

The model has `archivedAt` (set by the daily cron, 30+ days past
event end). When a user lands on `/events/<archived-slug>`:

- **C1: `notFound()` (404).** Standard Next.js handling. Crawlers
  re-encounter the URL eventually and forget it.
- **C2: Render a "this event has passed" page with HTTP 200.** The
  page has a "View similar upcoming events" CTA. SEO-wise this is
  arguable — the event content is no longer "live," but the URL has
  history.

**Recommended: C1.** 404 is the honest signal. The event is gone.
Crawlers shouldn't waste PageRank on a dead page, and users get a
clear "this event no longer exists" instead of a soft "this happened
in the past" page. If Johnny wants C2 for the long-tail historical
value, fall back to C2.

## Implementation order (after spec approval)

1. Add `src/app/events/[slug]/page.tsx` (server component) with
   `generateMetadata`, `generateStaticParams`, `notFound()`, the
   hero/title/dates/venue/description/CTA layout, and the inline
   `Event` + `BreadcrumbList` JSON-LD blocks.
2. Add `<JsonLd>`-style inline `<script>` blocks (the existing
   `src/components/seo/JsonLd.tsx` is fine; its `id` attribute is
   shared, doesn't matter for crawlers).
3. `npx tsc --noEmit` clean.
4. **Wait for Decision A** before touching `src/app/events/page.tsx`.
   If A1: change `getEventTarget` to return
   `{ href: '/events/<slug>', external: false }` for all events
   (drop the shareUrl/sourceUrl override). If A2: leave `page.tsx`
   alone, but add a "Details" link/button on each card.
5. Commit + push to master.
6. Live verification (the SEO/AEO audit framework's 5-line recipe):
   ```bash
   # Pick any approved event slug from the DB
   SLUG=$(psql ... -c "SELECT slug FROM \"Event\" WHERE status='APPROVED' AND \"archivedAt\" IS NULL LIMIT 1")
   curl -sL "https://www.moval.living/events/${SLUG}" | grep -c '"@type":"Event"'
   curl -sL "https://www.moval.living/events/${SLUG}" | grep -oE '<link rel="canonical"[^>]*>' | head -1
   ```

## Open questions for Johnny (in order of importance)

1. **Decision A** — Always link to `/events/[slug]` from the index
   (A1, recommended), or keep external links (A2)?
2. **Decision C** — 404 for archived events (C1, recommended), or
   soft "this event has passed" page (C2)?
3. The detail page CTA — should it always say "Get tickets" linking
   to `ticketUrl` (or `shareUrl` as fallback), even when the event is
   free? Or should it read "RSVP" / "Learn more" depending on whether
   tickets are required? (This is small; I can default to "Get
   tickets" and adjust if you want.)
4. The detail page does NOT show related events in this commit. If
   you want a "More events at this venue" surface in the same ship,
   say so — it's a small follow-on but I'd rather not surprise you.

## Risks

- **`shareUrl` is used today for redirect-style behavior on the index
  page** (`page.tsx:362-371`). If we go with A1, the index no longer
  honors `shareUrl` as a click target. The field stays in the schema
  and is still used as the ticket-URL fallback on the detail page, so
  we don't break the data; we just change one consumer. No data
  migration. Any user that has bookmarked a `shareUrl` from a social
  post is unaffected (those URLs are external ticketing sites).
- **AEO scrape timing.** When we ship, the existing 1,039 sitemap
  URLs (per the audit) do not include event detail pages. AI crawlers
  won't discover them via sitemap immediately — they'll find them via
  the events index, which they already crawl. If you want them in the
  sitemap in the same ship, that's a 5-line addition to
  `src/app/sitemap.ts` and I can fold it in.
- **`generateStaticParams` build time.** A static export of every
  approved, non-archived event slug at build time. Today's sitemap
  has 1,039 URLs and the events are a fraction of that; the SSG cost
  is bounded. If build time becomes a problem, switch the route to
  `export const dynamic = 'force-dynamic'` and revalidate on demand.

## Files touched (planned)

- `src/app/events/[slug]/page.tsx` — new, server component
- `src/app/events/page.tsx` — only if Decision A is A1
- (no schema migration)
- (no env var change)

## Verification

1. `npx tsc --noEmit` clean.
2. `npx next build` — verify the new route appears in the build output
   (`/events/[slug]` as a Dynamic or Static route).
3. Live: pick a real approved event slug, curl it, grep for:
   - `<link rel="canonical" href="https://www.moval.living/events/<slug>">`
   - `"@type":"Event"` in the initial HTML
   - `"@type":"BreadcrumbList"` in the initial HTML
4. Live: curl a non-existent slug, expect HTTP 404.
5. Live: curl an archived event slug, expect HTTP 404 (if Decision C is C1).
6. After Vercel deploy, run the canonical-audit recipe from the SEO/AEO
   framework: every events page that should exist has a canonical link.
