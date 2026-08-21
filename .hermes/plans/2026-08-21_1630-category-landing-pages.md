# Category landing pages — 2026-08-21 (P1)

## Goal

Add 22 indexable category landing pages at `/category/[slug]`, one per
category in `src/data/categories.ts`. Each page is a real
rank-able URL for the queries a directory exists to win
("Moreno Valley restaurants", "Moreno Valley plumbers",
"Moreno Valley auto repair") — today those queries have *no URL* on
the site because `/search?category=restaurants` canonicalizes back to
`/search` (verified `src/app/search/page.tsx:24`).

The new pages own the public-facing **"browse a category"** experience.
The existing `/search` page stays for interactive cross-category
filtering (it's a tool, not a destination).

## Why now

- Single biggest opportunity in Claude's audit. /events, /parks,
  /best-of, /homes, /outings, /spotlights, /partners all have
  index pages. Categories are the only major surface that doesn't.
- The schema is already correct: `Business.categoryId` is an FK to
  `Category.id` (verified `prisma/schema.prisma:9-10`). A simple
  Prisma `where: { category: { slug } }` returns the businesses.
- The helpers exist: `buildItemList()` and `buildFAQPage()` are
  already in `src/lib/seo-schema.ts` (lines 335 and 386). I reuse
  them verbatim.
- 22 categories fit in a single Prisma round-trip with `groupBy`,
  so we can pre-render the count in the heading without an N+1.

## Scope

### In scope (this commit)

- New route: `src/app/category/[slug]/page.tsx` (server component).
- `generateStaticParams` returns all 22 category slugs from
  `categories` (the static array in `src/data/categories.ts`). The
  data is small and stable; SSG is fine. If we later need to reflect
  per-category counts in the metadata description, switch to
  `force-dynamic` — the call is bounded.
- `generateMetadata`:
  - `title`: `<Category Name> in Moreno Valley, CA | moval.living`
  - `description`: parameterized from a per-category sentence
    (see Decision A below)
  - `alternates.canonical`: `https://www.moval.living/category/<slug>`
  - `openGraph` + standard defaults
- `notFound()` for unknown slugs (defensive — `generateStaticParams`
  should prevent this, but a stale URL or typo shouldn't 500).
- Page layout (proposed):
  1. **Hero band** — H1, 2–3 sentence intro, live count of approved
     businesses, small hero image (use the category's `image` URL).
  2. **Business grid** — same `BusinessCard` component `/search` uses
     (verified import in `src/app/search/page.tsx`), sorted by
     `compareBusinessesForSearch` for consistent EP/Featured/BestOf
     presentation.
  3. **FAQ block** — server-rendered `<FaqSection>` (the fixed one
     from commit `0621a98`, now server-component-safe). 3 questions
     per category. See Decision A.
  4. **Related categories** — at the bottom, a small grid linking to
     the 4 most-similar categories. See Decision B.
  5. **Internal-link footer block** — "See also" links to:
     `/search?category=<slug>` (for users who want filters),
     `/best-of` (for the curated tier), `/submit` (for business
     owners who want in).
- Inline JSON-LD (server-rendered, in initial HTML):
  - `ItemList` (built via `buildItemList(...)`) — the list of
    businesses. Each `ListItem` has `name`, `url`, `image` (logo),
    optional `description`.
  - `FAQPage` (built via `buildFAQPage(...)`) — the 3 questions.
  - `BreadcrumbList` — `Home › Categories › <name>`.
- Sitemap integration: add 22 entries to `src/app/sitemap.ts` in
  the staticPages block (priority 0.8, changeFrequency weekly).
- `llms.txt` integration: add a "## Categories" section listing the
  22 URLs with one-line descriptions.
- `/search` page edit: the category chips in the existing
  `CategoryFilter` (or equivalent) become `<Link href="/category/<slug>">`
  instead of `<Link href="/search?category=<slug>">`. The deep-link
  scroll-to-section behavior for `?category=` keeps working (we just
  leave the param handler alone, but the visible affordance points
  at the new pages).

### NOT in scope (this commit)

- A custom OG image per category. The hero image URL is in the
  initial HTML; a custom OG image is a follow-up.
- A "View all on map" surface. The category pages are list-only for
  now. A map view can come in a follow-up.
- Per-category schema (e.g. `Restaurant` for `/category/restaurants`).
  That's a much bigger scoping exercise and Claude didn't ask for it.
- Generating the per-category FAQ content via an LLM call. We
  hand-author the 3 questions per category (66 total) in a static
  data file. See Decision A.
- Editing `BusinessCard` to behave differently on `/search` vs
  `/category/[slug]`. The component stays the same; the page
  composition changes.

## Files touched (planned)

- `src/app/category/[slug]/page.tsx` — new, server component
- `src/app/category/[slug]/RelatedCategories.tsx` — small server
  component, picks the related 4
- `src/data/category-content.ts` — new, per-category intro + FAQ
  data file (22 categories × ~6 short fields)
- `src/data/category-relations.ts` — new, hand-curated
  "related categories" graph (22 entries, 4 each, so 88 hand-picks)
- `src/app/sitemap.ts` — add 22 entries
- `public/llms.txt` — add a "## Categories" section
- `src/app/search/CategoryFilter.tsx` — point chips at the new
  route
- (no schema migration)
- (no env var change)
- (no package.json change)

## Routing

```
GET /category/<slug>  →  src/app/category/[slug]/page.tsx
```

The 22 valid slugs come from `categories.map(c => c.slug)`. No
collision with existing routes (no other `src/app/category/*` path
exists; verified `find src/app -type d -name category*` returns
nothing).

## Decisions to lock before code

### Decision A — per-category intro + FAQ content

There are 22 categories. I need 22 intros and 22 FAQ sets. Three
options:

- **A1: Hand-author all 22 in a static data file.** Highest quality,
  100% on-brand, no AI-generated marketing copy. ~2 hours of writing.
- **A2: Template + one factual sentence per category.** Intro = a
  fixed template parameterized with `{name}` + one hand-written
  factual sentence (e.g. "X businesses in Moreno Valley's 92553,
  92555, 92557 zip codes"). Lower quality but ships fast.
- **A3: Single shared intro for all categories, 1 shared FAQ set.**
  Fastest, but every page looks identical and we lose the per-page
  AEO benefit.

**Recommended: A1 for the 4 highest-leverage categories
(restaurants, healthcare, contractors, auto-repair), A2 for the
other 18.** That gets the biggest queries to market first and the
remaining 18 still get indexable URLs with reasonable copy.

The 3 FAQ questions per category will be hand-written for the same
4 high-leverage categories and templated for the rest. 3 questions
is enough for FAQPage rich results without bloating the page.

If Johnny says "go with A1 for all 22," I will — it's a 1–2 hour
write, not a research problem. Defaulting to the hybrid.

### Decision B — related-categories graph

At the bottom of each category page, link to 4 related categories.
This is the internal-link juice that helps the whole category cluster
rank. Options:

- **B1: Hand-curated 22×4 graph** in `src/data/category-relations.ts`.
  Highest quality, takes 30 minutes to write.
- **B2: Auto-derived from `category.description` keyword overlap.**
  Lower quality, but the file is data and a one-time script can
  populate it.

**Recommended: B1.** The relations are editorial ("Plumbers are
related to Contractors and Home Services, not to Restaurants") and
auto-derivation will get them wrong in ways that hurt trust. 30
minutes to write, no script needed.

### Decision C — `/search` category chips

When a user clicks a category chip on `/search`, today they stay on
`/search?category=<slug>`. After this commit, do the chips go to
`/category/<slug>` instead?

- **C1: Yes, point chips at the new pages.** The dedicated page is
  the better experience (real H1, real OG, real canonical, real
  JSON-LD). The `/search` page becomes "all categories, all
  filters, default view."
- **C2: Keep chips on `/search?category=<slug>`.** Backward compat
  for users who learned the URL. Loses some of the AEO value
  because users stay on `/search` even when a dedicated page exists.

**Recommended: C1.** The `/search` deep-link still works for
anyone who has it bookmarked (it's just a scroll target now), so
we're not breaking anything. The chips become a clear "go to the
dedicated page" affordance.

### Decision D — what if a category has 0 businesses?

Empty state. Show the H1, intro, and a "No <category> in Moreno Valley
yet — be the first" message with a link to `/submit`. Don't 404;
empty pages still rank for "X in Moreno Valley" with the right copy
(Google is fine ranking thin-but-honest pages, and the
`<ItemList numberOfItems="0">` is technically valid).

## Implementation order (after spec approval)

1. Create `src/data/category-content.ts` and
   `src/data/category-relations.ts` with the 22 entries.
2. Create `src/app/category/[slug]/RelatedCategories.tsx` (server
   component).
3. Create `src/app/category/[slug]/page.tsx` (server component) with
   `generateMetadata`, `generateStaticParams`, the layout, and the
   three inline JSON-LD blocks.
4. Edit `src/app/search/CategoryFilter.tsx` (or wherever the chips
   are) to point at the new pages (Decision C).
5. Edit `src/app/sitemap.ts` to add the 22 entries.
6. Edit `public/llms.txt` to add the "## Categories" section.
7. `npx tsc --noEmit` clean.
8. Commit + push to master.
9. Live verification (one curl per category, 22 total):
   ```bash
   for slug in $(grep -oE "slug: '[^']+'" src/data/categories.ts | sed "s|slug: '||;s|'||"); do
     curl -sL "https://www.moval.living/category/${slug}" \
       | grep -oE '<link rel="canonical" href="[^"]*"|"@type":"ItemList"|"@type":"FAQPage"|"@type":"BreadcrumbList"' \
       | sort -u
   done
   ```
10. Sitemap verification:
    ```bash
    curl -sL https://www.moval.living/sitemap.xml | grep -oE '<loc>[^<]*category/[^<]*</loc>' | wc -l
    # expect: 22
    ```
11. llms.txt verification:
    ```bash
    curl -sL https://www.moval.living/llms.txt | grep -c "## Categories"
    # expect: 1
    curl -sL https://www.moval.living/llms.txt | grep -c "moval.living/category/"
    # expect: 22
    ```

## Open questions for Johnny (priority order)

1. **Decision A** — hybrid (recommended: hand-write 4 high-leverage
   categories, template the rest) or full hand-write for all 22?
2. **Decision C** — point category chips on `/search` at the new
   pages (C1, recommended) or keep them on `/search?category=`
   (C2)?
3. **Decision D** — empty state with "be the first" CTA (recommended)
   or 404 for empty categories?
4. The intro copy tone — match the editorial "Moreno Valley" voice on
   `/about-moreno-valley` (warm, local, first-person), or use a more
   direct, business-directory register ("Find the best plumbers in
   Moreno Valley")? The current recommendation is the first-person
   editorial voice, consistent with the rest of the site.

## Risks

- **/search and /category/[slug] show overlapping content.** A user
  who lands on `/search?category=restaurants` and on
  `/category/restaurants` should see roughly the same businesses.
  If the sorts diverge (e.g. `/search` is "best match" and
  `/category/[slug]` is "alphabetical"), users will notice. The fix:
  use the same `compareBusinessesForSearch` sort on both pages. I'll
  verify by hand after the first ship.
- **22 SSG pages add 22 build paths.** Bounded cost. If build time
  becomes a problem, switch to `force-dynamic` and let the
  edge cache handle freshness.
- **The FAQ content for the 18 templated categories may be lower
  quality than the 4 hand-written ones.** If a category's templated
  intro reads as obviously generic, Google may discount the page.
  Mitigation: write the templates with enough per-category facts
  (count, neighborhoods served, common services) to feel real.
- **The "related categories" graph is editorial.** A wrong link here
  (e.g. putting `dispensaries` next to `churches`) signals low
  quality to Google. The graph needs to be hand-curated, not
  auto-derived. Decision B1 is the right call.

## Verification

1. `npx tsc --noEmit` clean.
2. `npx next build` — verify the new route appears in the build
   output (22 paths, one per category slug).
3. Live: 22 curls, one per category, each returning a 200 with
   canonical + ItemList + FAQPage + BreadcrumbList in the initial
   HTML.
4. Live: 22 entries in `sitemap.xml`.
5. Live: 22 entries in `llms.txt`.
6. Live: visit `/search`, click a category chip, land on
   `/category/<slug>` (not `/search?category=<slug>`).
