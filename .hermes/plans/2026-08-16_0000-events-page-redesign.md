# Events Page Redesign — 2026-08-16

## Goal

Replace the 4-tab "Today / Weekend / Week / Month" + "Local/All" toggle with a cleaner layout:

- Top-level view tabs: **Today / Weekend / Week / Month**
  - Today/Weekend/Week = date-range filters scoped to "now"
  - Month = full-month view that **defaults to current month** (Aug 2026 today) but lets the user navigate forward/backward
- Once user is on a month view, navigation becomes:
  - **◀ / ▶ arrows** to go prev/next month
  - **Swipe gestures** (mobile)
  - **Month picker** (calendar grid dropdown / popover) for direct jump
- All approved events shown (no more Local/All toggle — Johnny wants everything)
- Filter chips for categories: **Sports / Music / Arts & Culture / Education / Family/Kids / Food & Drink / Community/Volunteer / Fundraisers / Holiday/Celebrations**

## URL state

- `view=today|weekend|week|month`
- `month=YYYY-MM` (only meaningful when view=month; defaults to current month)
- `cat=sports,music` (comma-separated, optional)

Examples:
- `/events` → today, current month
- `/events?view=weekend` → this weekend (Fri-Sun)
- `/events?view=week` → this week (7 days from today)
- `/events?view=month` → current month (e.g. Aug 2026)
- `/events?view=month&month=2026-09` → September 2026
- `/events?view=month&month=2026-12&cat=sports,fundraisers` → December 2026, sports + fundraisers only

## Categories

The `Event.category` field is a free-form String. We'll define an enum-ish set:

```ts
const CATEGORIES = [
  'sports',
  'music',
  'arts_culture',
  'education',
  'family_kids',
  'food_drink',
  'community_volunteer',
  'fundraisers',
  'holiday_celebrations',
] as const
```

Plus a display mapping:
- `sports` → "Sports"
- `music` → "Music"
- `arts_culture` → "Arts & Culture"
- `education` → "Education"
- `family_kids` → "Family / Kids"
- `food_drink` → "Food & Drink"
- `community_volunteer` → "Community / Volunteer"
- `fundraisers` → "Fundraisers"
- `holiday_celebrations` → "Holiday / Celebrations"

## Auto-categorization (because no events have categories yet)

Existing 107 approved events need categories. Heuristic mapping based on `venueTag` + title keywords:

| Category | Venue tags | Title keywords |
|---|---|---|
| sports | CBU, UCR, MOVAL_HIGH_SCHOOL | (sport keyword) |
| music | FOX_RIVERSIDE, RIVERSIDE_MUNICIPAL_AUDITORIUM | concert, band, orchestra, symphony, jazz, rock, tribute, singer, DJ |
| arts_culture | RIVERSIDE_ART_MUSEUM, RIVERSIDE_METROPOLITAN_MUSEUM, REDLANDS_THEATER_FESTIVAL | theater, theatre, comedy, art, museum, gallery, ballet, dance, exhibit |
| education | — | lecture, workshop, expo, education, school, class, summit, conference |
| family_kids | — | kids, children, family, toddler, story, easter, halloween, bluey |
| food_drink | — | taste, food, wine, beer, dinner, brunch, festival (food context), bbq |
| community_volunteer | — (city of MoVal events go here) | volunteer, community, day of service, drive, awareness |
| fundraisers | — | fundraiser, gala, benefit, charity, donation, auction |
| holiday_celebrations | — | christmas, holiday, tree lighting, easter, halloween, fourth of july, day of dead, veterans day, snow day |

Run a one-off script `scripts/_categorize-events.mjs` to assign categories to all 107 existing approved events. Then commit the result and delete the script.

For new ingests (CBU/UCR/MVUSD sports), we can either:
- (a) Set category in the ingest payload (we'd need to add the field)
- (b) Run the same categorization script as a post-ingest step

For now: ingest payload doesn't have category, so all 515 HS + 29 UCR + 27 CBU events would default to no category. Add `category: 'sports'` to the ingest payload for future sports ingests. Apply retroactively via the categorize script.

## Date/month navigation (the carousel part)

For `view=month`:
- Show events whose `startsAt` falls within that calendar month (e.g. Aug 2026 = Aug 1 00:00 UTC to Sep 1 00:00 UTC)
- Top of section shows: `◀ August 2026 ▶` with a small "📅 Pick month" button
- "Pick month" opens a small month-year picker (current year ± 1, clickable months)
- Swipe on the events container → prev/next month
- Prev/next arrows change URL via `router.push` (Next.js client component)

For `view=today|weekend|week`:
- Show the same bento grid as before, no month nav

## Layout sketch

```
┌─────────────────────────────────────────────┐
│  📅 Community Events                       │
│  What's happening in and around Moreno Valley │
├─────────────────────────────────────────────┤
│  [Today] [Weekend] [This Week] [This Month] │ ← tabs
│                                              │
│  Filters:                                    │
│  [Sports] [Music] [Arts] [Education] [Family]│ ← chips
│  [Food] [Community] [Fundraisers] [Holiday]  │
├─────────────────────────────────────────────┤
│  When viewing "This Month":                  │
│  ◀  📅 August 2026  ▶   [Pick month]        │
├─────────────────────────────────────────────�
│  HERO card (full width)                      │
│  Honorable Mentions (3 cards)                │
│  More Events (grid of STANDARD cards)        │
└─────────────────────────────────────────────┘
```

## Components

- `src/app/events/page.tsx` — server component, fetches events by view + month + categories
- `src/app/events/MonthNav.tsx` — client component, prev/next arrows + month picker + swipe
- `src/app/events/CategoryFilter.tsx` — client component, chip-style multi-select
- Reuse existing card components (HeroCard / HonorableCard / StandardCard) — they stay in page.tsx

## Implementation order

1. **Write the categorize script** + run it → 107 events get categories
2. **Build CategoryFilter component** (client component)
3. **Build MonthNav component** (client component, with swipe via pointer events)
4. **Rewrite events/page.tsx** (server component, uses new search params)
5. **Type-check** (tsc --noEmit)
6. **Commit + push** to master
7. **Visual smoke test** — visit `/events`, `/events?view=month&month=2026-09&cat=sports`

## Things to preserve

- The 4 card components (HeroCard, HonorableCard, StandardCard) — they're good, just keep them
- Submit-event CTA at the bottom
- Empty state when no events in range
- The hero/honorable/standard tiering logic

## Things to remove

- Local Region / All Events toggle (gone)
- The region filter from URL state (gone)
- The `viewRange` function for `week` (was a 7-day rolling window — keep this since Johnny said "this week" should be the next 7 days from today, not the calendar week)
- The view-tabs `month` option needs renaming: was "This Month" (rolling 30 days), now "Month" (calendar month view, navigated via arrows)

## Decision: rolling vs calendar week

Johnny's "this week" — I'll keep it as a rolling 7-day window (today + 6 days) for simplicity. If he wants Monday-Sunday I'll adjust.

## Decision: which event tier shows hero

The HERO tier is currently set on at most one event per query. The bento shows HERO → HONORABLE_MENTION → STANDARD. With 562 events to review and likely many will get HERO tier from Johnny, we might end up with multiple HEROs in a month view. Let me check how many HEROs exist:
