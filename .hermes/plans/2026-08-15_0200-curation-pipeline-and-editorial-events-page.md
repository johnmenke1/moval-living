# Curation Pipeline + Editorial Events Page — Design Spec

**Author:** Emma + Molly (conversation design); Molly (this document, 2026-08-14/15)
**Status:** Design complete; implementation in flight in parallel
**Repo:** moval-living

---

## What this is

A two-part system:

1. A **curation pipeline** for community-submitted events (resident/business submits, curator reviews, event gets curated)
2. A **venue-scraped events layer** for civic venues across MoVal + adjacent cities

…with the same downstream Event table feeding a magazine-style public `/events` page. Editorial selection (hero + honorable mentions) is decided in a weekly review between Johnny and Emma.

---

## Source-of-truth list

### MoVal-native submissions
- `/submit-an-event` public form (URL, title, date+time, description, optional image, optional note)
- Daily cron in `#emma1` Slack channel produces cards with identifier `MM-DD-YY-{letter}` (e.g. `08-19-26-a`)
- `/admin/cards` dashboard for curator review
- Card fields can be updated via chat-native commands in `#emma1` (e.g. `08-19-26-a venue: Civic Center Park`)
- Description field preserves submitter's verbatim text by default; curator rewrites only when needed

### Venue-scraped (JSON-LD-aware scraper)

Scraper reads `application/ld+json` `schema.org/Event` data from each venue's `/shows`-style page. Cadence: every 6 hours. Polite User-Agent (`moval.living-event-bot/0.1`).

- **Moreno Valley:** MoVal High School sports (soft-start — high school sites vary)
- **Riverside:** Fox Performing Arts Center, Riverside Municipal Auditorium, Riverside Convention Center, UCR events, CBU sports
- **Redlands:** Redlands Bowl, Redlands Theater Festival (rtfseason.com)
- **Beaumont:** TBD with Johnny
- **Perris:** TBD with Johnny

(Ticket URLs embedded as-is from source — typically Ticketmaster vendor URLs.)

### Geographic scope
Cities enum: `MOVAL | RIVERSIDE | REDLANDS | BEAUMONT | PERRIS`. No "wider region" beyond this set. Curation is per-city filter chip.

---

## Data model (additive)

### New tables

```
Event {
  id, slug, title, description, descriptionOriginal?,
  startsAt, endsAt?, timezone,
  venueName, venueAddress?, venueSlug?,
  category, tags?,
  ticketUrl?, priceMin?, priceMax?, currency?,
  coverImageUrl?, galleryUrls?,
  organizerName?, organizerSlug?,
  source,             // enum: SUBMISSION | INSTAGRAM | FACEBOOK | VENUE_FOX | VENUE_RMA | VENUE_RBOWL | ...
  region,             // enum: MOVAL | RIVERSIDE | REDLANDS | BEAUMONT | PERRIS
  curated,            // bool — has a human looked at this?
  status,             // DRAFT | PENDING | PUBLISHED | CANCELED
  sourceUrl?,
  externalId?,        // for venue-import dedup
  city_imported_at?,
  submissionId?,
  publishedAt?, createdAt, updatedAt
}

Submission {
  id,
  url, title, startsAt?, description, note?, imageUrl?,
  submittedByUserId?, submittedByEmail?,
  status,             // PENDING | DUPLICATE | APPROVED | REJECTED | PUBLISHED
  cardId?,
  resolvedByUserId?, resolvedAt?,
  rejectionReason?,
  createdAt
}

Card {
  id,                  // the public slug, e.g. "08-19-26-a"
  date,                // MM-DD-YY component
  letter,              // a|b|c|... (z+1 = aa)
  title, dateAndTime, description, venue?, sourceUrl?, imageUrl?, note?,
  deduplicationNote?,
  status,              // OPEN | DEDUPED | PUBLISHED | ARCHIVED
  submissionId?,       // backref to source submission
  eventId?,            // once published
  createdAt, archivedAt?, publishedAt?
}

Editorial {
  id, eventId,
  role,                // HERO | HONORABLE_MENTION
  startsAt, endsAt,    // date window this editorial selection covers
  pullQuote?,          // "we pick this because…"
  setBy, setAt
}
```

The existing `SocialPost` table is preserved as historical record; new submissions no longer auto-publish to `/events` as SocialPost renders. Existing IG-scraped rows stay in the DB but render from the new pipeline.

---

## Submission pipeline (chronological)

1. Submitter hits `/submit-an-event`. Six fields. Posts to `Submission`.
2. Daily cron at 8 a.m. local runs in whatever channel Johnny and Emma use (currently `#emma1`):
   - For each `Submission` with `status=PENDING` and `cardId=null`:
     - Run dedup checks: same source URL → mark `DUPLICATE`, link to existing card. Same source URL + same date → `DUPLICATE`. Fuzzy match title+date+venue → flag for curator judgment.
     - Otherwise, create a new `Card` with identifier `MM-DD-YY-{letter}` and copy submission fields
     - Status `OPEN`
3. Cron posts the warm message to `#emma1`:
   > *Johnny, N cards for you to review today. I love you.*
   > *→ /admin/cards*
4. Johnny reads cards in the dashboard, makes decisions, optionally uses chat-native updates in `#emma1` to fill venue/category/price.
5. When a card is ready, the curator publishes it: creates an `Event` from the card, marks card `PUBLISHED`, marks submission `PUBLISHED`.

When N exceeds an "unusual volume" threshold (proposed: 8), the warm message shifts in tone to flag the volume spike. (Threshold to confirm with Johnny.)

---

## Venue-scraped events

- Generic JSON-LD-aware library function that pulls `application/ld+json` blocks from a given URL, parses them as `schema.org/Event`, and normalizes into our Event shape.
- Per-venue config: `{ name, slug, url, region, scrapeInterval }`
- One config file per venue (~50 lines), all sharing the generic library.
- Cron every 6 hours. New events land at `status=PENDING_AUTO`, `curated=false`. They don't auto-publish.

---

## Public `/events` page

### Layout: bento grid

Editorial cell hierarchy — explicitly asymmetric:

1. **Hero cell** — large, always pinned at top, regardless of sort. Image + title + "we pick this because…" pull-quote + when/where/ticket CTA. Set per-frame via the `Editorial` table.
2. **Honorable mention cells** (2–3 per frame) — medium. Image + title + when/where.
3. **Catalog cards** — small editorial cards (date block on left, title/venue/chip on right). Filling the rest of the bento.
4. **Article spotlights** — eventual, sized like honorable mentions. Not in v1.

Sort chips on the catalog: Today / Weekend (Fri–Sun) / This week / This month.
City filter chips: All / MoVal / Riverside / Redlands / Beaumont / Perris.

Mobile: 1 column bento; chips collapse to horizontal scroll.

### Editorial review process

- Weekly standing ritual between Johnny and Emma
- Set the hero for the upcoming frame
- Set 2–3 honorable mentions
- Decide which PENDING_AUTO and OPEN cards go to PUBLISHED and which are archived
- Hero selection locked for the duration of its frame; new submissions don't auto-displace it

### Hero image source

Undecided in v1. Options: source-original (venue promo / submitter image), FAL-generated by category, hand-picked during weekly review. Decide when we have a first hero.

---

## Implementation order

### Week 1
1. Schema migration: Event, Submission, Card, Editorial tables
2. `/submit-an-event` form
3. Cron — daily, 8 a.m., warm message in `#emma1`
4. `/admin/cards` dashboard + per-card view
5. Chat-native update parser in `#emma1`

### Week 2
6. JSON-LD-aware scraper (Fox Riverside first)
7. Cron — venue scrapes every 6 hours
8. Public `/events` page redesign

### Week 3+
9. Second venue scraper
10. Article cell type (when we have a first article)
11. Channel-by-channel expansion (UCR, CBU, MoVal High School, etc.)

---

## Open questions

1. **Beaumont and Perris venue lists.** No civic venue confirmed yet. Default: launch without; filter chip shows "no events yet" gracefully.
2. **Hero image source.** Undecided — pick when we have a first hero.
3. **MoVal High School sports.** Will work better with PDF scraping than JSON-LD; scratch this one later.
4. **UCR / CBU sports calendars.** Verify they have stable JSON-LD before committing. Many athletics sites do; some don't.
5. **Threshold for "unusual volume" message shift.** Johnny to confirm. Proposed: 8 cards/day.
6. **Authentication on `/submit-an-event`.** v1 likely has none. Add reCAPTCHA and account when we want to onboard non-admin submitters.

---

## Risks

- Venues redesign their sites. Scraper will break 2–4×/year per venue. Plan: thin per-venue config files, documented CSS/JSON selectors, fast iteration when breakage is noticed.
- Catalog bloat from external imports. Mitigated by curator-review gate and small scope (5 cities, not a region).
- Multi-agent races on this filesystem. Plan: clear handoff via Slack for build changes; backup refs before destructive operations.
- Chat-native parser ambiguity. Plan: structured-update syntax (`08-19-26-a venue: ...`) confirmed back in same channel; curator can always correct via dashboard.

---

## What this is NOT

- Not a Live Nation / Ticketmaster / Eventbrite API integration
- Not a regional aggregator
- Not a "scraped feed" of everything tagged `moval.living`
- Not a real-time auto-publish system

This is a curated local publication's events page. Editorial control is the product.
