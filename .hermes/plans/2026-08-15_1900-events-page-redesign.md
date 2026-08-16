# /events Page Redesign — Spec

**Date:** 2026-08-15
**Status:** Approved, in flight
**Branch:** design-refresh
**Author:** Molly

---

## Goals

1. Drop the regional/local filter (show all approved events)
2. Add category filter chips: Sports, Music, Educational, Fundraisers (multi-select)
3. Convert "This Month" from "next 30 days" to a true month-by-month picker
4. Backfill categories for the 80 existing Fox/RMA events so filters are useful on day one

---

## Changes

### 1. Schema migration

Replace `Event.category: String?` with `Event.category: EventCategory?` enum.

```prisma
enum EventCategory {
  SPORTS
  MUSIC
  EDUCATIONAL
  FUNDRAISERS
  COMMUNITY       // Reserved for future use
  ARTS            // Reserved for future use
  FAMILY          // Reserved for future use
}
```

**Phase 1 categories (active UI):** Sports, Music, Educational, Fundraisers
**Phase 2+ reserved:** Community, Arts, Family (in enum, not surfaced yet)

**Backfill query** for existing 80 Fox/RMA events:

```sql
UPDATE "Event" SET "category" = CASE
  WHEN "venueTag" IN ('FOX_RIVERSIDE', 'RIVERSIDE_MUNICIPAL_AUDITORIUM') THEN 'MUSIC'
  WHEN "venueTag" = 'CBU' THEN 'SPORTS'
  WHEN "venueTag" IN ('REDLANDS_BOWL', 'REDLANDS_THEATER_FESTIVAL') THEN 'ARTS'
  WHEN "venueTag" = 'MOVAL_HIGH_SCHOOL' THEN 'SPORTS'
  WHEN "venueTag" = 'UCR' THEN 'SPORTS'
  ELSE NULL  -- resident submissions: curator picks during review
END
WHERE "category" IS NULL;
```

This populates categories for venue-imported events. Resident submissions (cityofmorenovalley author handle) get `category = NULL` until curator picks.

**Curator dashboard:** `EventSubmissionsPanel.tsx` should get a category dropdown on each pending submission so curators assign before approval. That's a UI addition to the panel.

### 2. Drop regional toggle

Remove `region` URL param parsing, the `REGIONAL_VENUE_TAGS` / `REGIONAL_CITIES` filters, and the Local/All Events buttons. Default is "show all approved."

**Files to modify:**
- `src/app/events/page.tsx` — remove region prop parsing, simplify `where` clause

### 3. Add category filter chips

Below the sort row, add a horizontal-scroll row of category chips. Multi-select via URL params.

```
?view=month&cat=SPORTS,MUSIC   ← both filters active
?view=month                    ← all categories
?view=month&cat=SPORTS          ← just sports
```

**Empty selection = show all categories.** (Equivalent to no `cat` param.)

**Chip count badges:** Each chip shows the count of currently-matching events. E.g. "Sports (12)" if there are 12 sports events in the current view's date range. Real-time-ish — calculated server-side on each render.

**Server-side query:**

```typescript
const selectedCategories = searchParams.cat?.split(',').filter(Boolean) ?? []
const where: Prisma.EventWhereInput = {
  startsAt: { gte: range.start, lt: range.end },
  ...(selectedCategories.length > 0 ? { category: { in: selectedCategories } } : {}),
}
```

### 4. Convert "This Month" to month picker

When `view=month`, instead of "next 30 days," show a calendar grid of the current month. Click on any day to see events that day. Arrow buttons navigate to previous/next month.

**UI shape:**

```
[ ← Aug 2026 → ]   ← Month header with prev/next arrows
                    ← Today button (jumps to current month)

  S  M  T  W  T  F  S
  .  .  .  .  .  .  1
  2  3  4  5  6  7  8
  9 10 11 12 13 14 15
  16 17 18 19 20 21 22
  ...

  ▼ On Aug 22, 2026:
  - CBU Men's Basketball vs North Florida, 7pm
  - RMA: Tom Petty tribute, 8pm
```

Click a day with events → expand to show events below the grid.
Click a day without events → just shows the date with no list (or hides itself).

**URL state:**

```
?view=month                            ← default = current month
?view=month&month=2026-08              ← explicit month
?view=month&month=2026-08&day=22       ← focused day (expand events for that day)
```

**Implementation:** Use `date-fns` (already in project) for month math. Server-render the calendar grid. Arrows are `<Link>` components that change the `month` URL param.

**Phase 2 (deferred):** swipe gesture for mobile, lazy-loading of distant months.

---

## Sort row UI (final)

```
[ Today ]  [ Weekend ]  [ This Week ]  [ This Month ]
```

Single-select (URL state via `view` param).

When `view=month` is active and no explicit `month` param, default to current month.

---

## Category chip row UI (final)

```
[ Sports (12) ]  [ Music (47) ]  [ Educational (3) ]  [ Fundraisers (5) ]
```

Multi-select, additive. Counts computed from current date range (not from current category filter).

**Visual treatment:**
- Inactive chip: light gray border, gray text
- Active chip: primary-color border, primary-color text, slightly bolder
- Clicking an inactive chip adds it; clicking an active chip removes it
- Result: URL rebuilds with new `cat` param set

---

## Out of scope (v2+)

- Swipe gesture for month navigation on mobile
- Lazy-loading of far-future months
- Category-colored events (e.g. Sports chips tinted green)
- "Featured events" curation beyond the existing HERO/HONORABLE_MENTION tiers
- Per-venue filters (could add `venue=Fox,RMA` style filter later)

---

## Migration risk

- Existing `Event.category` rows have free-text strings (mostly null, but any populated ones will fail the enum cast). The migration adds `.alterColumn()` with a safe transform.
- Backfill UPDATE runs in a single transaction.
- 80 existing Events will get category assignments based on venueTag.

## Open questions

1. **Should we add a "This Weekend" focus mode?** Currently Weekend = Fri-Sun. Could keep that.
2. **Should category filter chips show counts when no date filter is active?** i.e. when view=today, chips show today's counts (might be 0/0/0/0). Maybe hide chips if all counts are 0?
3. **Should we add a search input?** out of scope for v1.