# Answer capsules on remaining hub pages (2026-08-22)

## Goal

Extend the answer-capsule pattern from `feat(aeo): answer capsule on /best-of` to the remaining hub pages. Each hub page gets a 2-3 sentence direct answer in the first ~150 words of server-rendered HTML, above the interactive UI, sourced from the same DB query the page already runs.

## Why now

The `/best-of` capsules (commits 9736067, 6358ef0, 7b56c33, fc0b809) shipped and live-verified. AI engines (ChatGPT, Perplexity, Claude) lift the first ~150 words of HTML when answering direct questions. The other hub pages still answer with marketing copy ("Observations and reflections on what makes Moreno Valley a remarkable place to live") — not the direct-answer shape that gets cited.

## Audit — route-by-route

### 1. `/parks` — Parks index

**Existing copy:** the page metadata description is "Every City of MoVal park on one interactive map — parks, trails, Cottonwood Golf Center, and recreation facilities. Filter by amenities, find parks near you, and explore user-submitted photos."

**Data available** (from `getParks()` at `src/app/parks/page.tsx:53`):
- `name`, `slug`, `type`, `address`, `city`, `state`, `zip`
- `latitude`, `longitude`
- `amenities: string[]` — 17 amenities including dog_park, splash_pad, pump_track, etc.
- `googleRating`, `googleReviewCount`
- `featured: boolean`
- `faqsJson`

**Data NOT available** (verified from `prisma/schema.prisma` Park model):
- ❌ **No acreage field.** Johnny's example "the largest are X" — we can't ship this without inventing data. **Ship the count-only capsule, defer "largest" until we add acreage.**
- ❌ No established date
- ❌ No visitor count

**Capsule shape (proposed):**
"Moreno Valley has [N] public parks, trails, and recreation facilities maintained by the City of MoVal — including [top 3 by google review count: name A (rating, reviews), name B, name C]. Filter by amenities (dog park, splash pad, pump track, etc.) below."

This is honest — count is real, top 3 by review count is real, amenity list is real.

**Placement:** `src/app/parks/page.tsx` between the `<JsonLd>` and `<ParksClient parks={parks} />` calls (the ParksClient component currently owns the entire visible UI; the page.tsx wraps it). A `<p>` rendered before `<ParksClient>` will be in initial HTML above the interactive map.

### 2. `/events` — Events calendar

**Existing copy:** "Find concerts, school sports, fundraisers, festivals, and other community events in Moreno Valley and nearby Inland Empire venues."

**Data available** (from the events query, verified by reading `src/app/events/page.tsx`):
- Event `startDate`, `endDate`
- Event `title`, `venueName`, `address`, `city`
- Event `tier` (HERO, HONORABLE_MENTION, etc.)
- Event `category`
- Event `language` (English / Spanish)
- The page already filters by view=today/weekend/week/month

**Capsule shape (proposed):**
"Looking at the [current view label: 'This Weekend' / 'Today' / 'This Week' / month name], there are [N] upcoming events in and around Moreno Valley — including [top 3 by tier+date: name A at venue on date, name B, name C]. Browse the calendar below by day, week, or month."

This is honest — the view label and count are real, the top 3 are real.

**Placement:** `src/app/events/page.tsx` near the top of the render (before the calendar). Need to read more of the file to find the right insertion point — likely after `<EventsHero />` or before the calendar grid.

### 3. `/life` — Life in MoVal (editor essays)

**Existing copy:** "Observations and reflections on what makes Moreno Valley a remarkable place to live."

**Data available** (from `src/app/life/page.tsx:31`):
- Published LIFE posts (postType: 'LIFE')
- Ordered by `publishedAt: 'desc'`, take 50
- Each post has `slug`, `title`, `excerpt`, `heroImageUrl`, `publishedAt`

**Capsule shape (proposed):**
"Life in MoVal is a journal of [N] essays on what makes Moreno Valley a remarkable place to live — recent stories cover [top 3 by date: 'Title A' by date, 'Title B', 'Title C']. New essays publish [cadence: weekly / monthly]."

This is editorial-voice (matches `/about-moreno-valley`) and concrete (count, titles, cadence).

**Placement:** `src/app/life/page.tsx` between `<LifeHero />` and `<LifeArticlesGrid />`.

### 4. `/outings` — Outings (day trips)

**Existing copy:** "Photo essays from John Menke exploring the hidden gems and must-see destinations around Moreno Valley and the broader Inland Empire."

**Data available** (from `src/app/outings/page.tsx:23`):
- Published OUTING posts, ordered by publishedAt desc, take 50
- Same shape as life posts

**Capsule shape (proposed):**
"Outings from Moreno Valley covers [N] day trips and short escapes within driving distance — recent essays: [top 3 by date: 'Title A' (distance), 'Title B', 'Title C']. Most are 1-2 hour drives; some are Metrolink-accessible."

Wait — distance data isn't on the post model. Strip the parenthetical. Better:
"Outings from Moreno Valley covers [N] day trips and short escapes within driving distance of the Inland Empire — recent photo essays: [top 3 by date: 'Title A', 'Title B', 'Title C']. Most are 1-2 hour drives; some are Metrolink-accessible."

**Placement:** between `<OutingsHero />` and `<OutingsMagazineGrid />`.

### 5. `/insights` — Guest insights (community voices)

**Existing copy:** "Curated takes from local professionals, business owners, and community voices on life in Moreno Valley."

**Data available** (from `src/app/insights/page.tsx:31`):
- Published GUEST posts, with author include
- Each post has author with `displayName`, `title`, `companyName`

**Capsule shape (proposed):**
"Insights is a collection of [N] essays from local Moreno Valley voices — professionals, business owners, and community members writing about [topic cluster: moving, buying, living in the valley]. Recent authors: [top 3 by date: 'Author A (Title at Company)', 'Author B', 'Author C']."

Topic cluster is risky — needs to be a real category or skip it. Simpler:
"Insights is a collection of [N] essays from local Moreno Valley voices — [N unique author count] community members writing about life in the valley. Recent contributions: [top 3 by date: 'Title A' by Author A, 'Title B' by Author B, 'Title C' by Author C]."

**Placement:** between `<InsightsHero />` and `<InsightsArticlesGrid />`.

### 6. `/spotlights` — Video spotlights

**Existing copy:** "Short-form video spotlights featuring the people and businesses that make Moreno Valley special."

**Data available** (from `src/app/spotlights/page.tsx:16`):
- Published SPOTLIGHT posts, ordered by publishedAt desc, take 50
- **DB has 0 published SPOTLIGHT rows** (verified earlier this session — spotlights DB probe). The page shows "No spotlights published yet. Check back soon."

**Capsule shape (proposed):**
"Spotlights are short-form video profiles of the people and businesses that make Moreno Valley special. [N] videos published so far — newest: [top 1 by date: 'Title A' from YouTube]."

**Edge case:** with 0 published posts, the capsule is "Spotlights launches [date] — short-form video profiles of the people and businesses that make Moreno Valley special. Subscribe to be notified when the first video lands."

**Placement:** between the `<header>` and the grid.

### 7. `/category/[slug]` — Directory category pages

**Existing copy:** each category has its own 2-3 sentence hand-written intro from `src/data/category-content.ts` (per commit `d034e80`).

**Data available** (from `src/app/category/[slug]/page.tsx`):
- Category name + slug
- `businesses` array (the page's main grid)
- Hand-written intro from `category-content.ts`

**Critical design decision:** the category pages **already have hand-written intro copy** that's specifically designed for SEO/AEO. Adding an "answer capsule" on top would either:
- (a) Replace the intro — breaks the work I shipped earlier
- (b) Sit above the intro — duplicates editorial content
- (c) Live inside the intro paragraph — same shape, different framing

Option (a) is wrong — the category-content.ts work was deliberate and well-tested. Options (b) and (c) require careful judgment.

**Recommendation: defer `/category/[slug]`.** The hand-written intros are the answer capsule for these pages — they were designed for the same purpose. Adding more would compete with existing work, not complement it. **The other 6 hub pages are higher-leverage because they currently have generic copy, not hand-written copy.**

## Plan — 6 surgical commits, one per hub page

Each commit is the same shape:
1. Compute capsule text from the existing query
2. Render `<p>` between the hero and the interactive UI
3. No new DB query, no new schema
4. Live-verify the capsule text is in initial HTML

### Commit 1: `/parks` answer capsule
- File: `src/app/parks/page.tsx`
- ~10 lines: compute count + top 3 by review count, render `<p>`

### Commit 2: `/events` answer capsule
- File: `src/app/events/page.tsx`
- ~15 lines: use the existing view label + count + top 3
- Need to read the events page main render to find the right spot

### Commit 3: `/life` answer capsule
- File: `src/app/life/page.tsx`
- ~10 lines: count + 3 most recent titles

### Commit 4: `/outings` answer capsule
- File: `src/app/outings/page.tsx`
- ~10 lines: count + 3 most recent titles

### Commit 5: `/insights` answer capsule
- File: `src/app/insights/page.tsx`
- ~12 lines: count + unique author count + 3 most recent (title + author)

### Commit 6: `/spotlights` answer capsule
- File: `src/app/spotlights/page.tsx`
- ~10 lines: count + most recent title OR "launching soon" empty-state copy

## Decision: defer `/category/[slug]`

The hand-written intros already serve the answer-capsule purpose. Re-read the original commit (d034e80) before adding anything that would compete with existing work.

## What this does NOT touch

- `/category/[slug]` — existing hand-written intros (deferred)
- `/about-moreno-valley` — already has answer-shape copy (verified earlier)
- `/events/[slug]` — event detail pages, different answer shape ("when is [event], where is it")
- `/parks/[slug]` — park detail pages, different answer shape ("[Park] is a [type] park in Moreno Valley")
- `/life/[slug]` `/outings/[slug]` `/insights/[slug]` `/spotlights/[slug]` — single article/video pages, different answer shape

The detail pages are a separate audit — same pattern applies but the answers are per-article/per-park, not per-section.

## Risks I'm choosing to accept

- **Per-page caption text drifts from the cards below.** Mitigated: every capsule text is computed from the same array the cards render from. If the data changes, both update.
- **Top-3-by-review-count parks might be the same top-3 month after month.** That's fine for SEO/AEO purposes — the capsule is correct even if stable.
- **Life/Outings/Insights titles are editorial, not factual.** AI engines lift factual claims. The "Life is a journal of N essays" framing uses the count as the factual anchor; the titles are context, not claims. Same with Outings ("N day trips") and Insights ("N essays from N authors"). This pattern should work.
- **Spotlights with 0 published posts gets "launching soon" copy.** AI engines won't lift "launching soon" as an answer, but at least it's not marketing copy that's wrong.

## Verification recipe

After each commit:
1. `npx tsc --noEmit` clean
2. `npx next build` clean (revert `next-env.d.ts` after build)
3. Live verify: `curl -sL https://www.moval.living/<route>` and grep for the capsule sentence in the body text — must appear in the first 200 words of `<body>`.
4. Live verify the page renders the cards below — no regression in interactive UI.

## Open question

The `/events` capsule depends on the current view (`today`, `weekend`, `week`, `month`). For the default `month` view, the capsule text is "In [Month YYYY], there are N events..." — fine. For `today`/`weekend`/`week` views, the capsule adapts. Implementation: compute the view label from the searchParams the page already reads, then use it in the capsule.

Edge case: empty events list (no events in this view). Capsule falls back to "There are no events scheduled for [view label] — check back soon or browse other time ranges."

## Reference

- `feat(aeo): answer capsule on /best-of/[category]` — 9736067 + 7b56c33 + fc0b809
- `feat(aeo): answer capsule on /best-of` — 6358ef0
- `feat(aeo): edge-case handle empty state on /best-of capsule` — b3f5f6d (parallel agent)

Pattern is established. Same shape, different data per route.