# Sunday Events Review — 2026-08-15

First weekly review run.

## Ingested (7 events)

From official MoVal city calendars and Redlands Bowl season page.

### Moreno Valley city-organized events (6)

| Slug | Title | Date | Time | Source |
|---|---|---|---|---|
| 08-15-26-d | Community Day of Service | 2026-10-10 | 8am-12pm PT | moval.org/parks-comm-svc/ics/fall-day-of-service.ics |
| 08-15-26-e | Day of the Dead Celebration | 2026-10-31 | 5pm-9pm PT | moval.org/dayofthedead |
| 08-15-26-h | Veterans Day Ceremony | 2026-11-11 | 10am-12pm PT | moval.org/parks-comm-svc/ics/fall-veterans-day.ics |
| 08-15-26-i | Fun Color Run | 2026-11-14 | 8am-11am PT | moval.org/parks-comm-svc/ics/fall-fun-color-run.ics |
| 08-15-26-f | Holiday Tree Lighting | 2026-12-05 | 5pm-8pm PT | moval.org/parks-comm-svc/ics/winter-tree-lighting.ics |
| 08-15-26-j | Holiday Snow Day | 2026-12-05 | 11am-3pm PT | moval.org/parks-comm-svc/ics/winter-snow-day.ics |

### Redlands Bowl (1)

| Slug | Title | Date | Time | Source |
|---|---|---|---|---|
| 08-15-26-g | A Holiday Evening with Phat Cat Swinger | 2026-12-04 | 8pm PT | aboutredlands.com/redlands-events/redlands-bowl-summer-music-festival-2026-season |

## Housekeeping (existing events)

### Re-tagged venueTag + city

| Event | venueTag (was) | city (was) | venueTag (now) | city (now) |
|---|---|---|---|---|
| Mix for Teens | OTHER | null | OTHER | Moreno Valley |
| Education Expo | OTHER | null | OTHER | Moreno Valley |
| Taste of the Valley | OTHER | null | OTHER | Moreno Valley |
| Halloween Village | OTHER | null | OTHER | Riverside |
| Guns, Faith and Freedom Rally | OTHER | null | OTHER | Riverside |

(venueTag stays OTHER since we don't have a dedicated MoVal-city enum yet.
Local Region filter accepts "Moreno Valley" by city regardless of venueTag.)

### Regenerated hero images

3 stale FLUX-era heroes replaced with Recraft V3:
- The Mix for Teens
- Education Expo (also added venueName = "Moreno Valley College")
- Halloween Village

## New endpoints shipped

- `POST /api/admin/ingest/events` — creates PENDING Submissions from
  city calendar data without going through the public submission form.
- `POST /api/admin/events/regenerate-hero` — admin/cron can re-run hero
  generation for an approved Event.

## Files changed (master)

```
7551dc8  feat(events): internal ingest endpoint for city calendar events
d4c1ca5  feat(events): admin endpoint to regenerate hero image for existing event
9843748  feat(events): allow CRON_SECRET auth on regenerate-hero too
2ce9d5d  fix(events): generate-poster handles OTHER sourcePlatform too
```

## State of the queue

7 PENDING submissions, all with Recraft-generated hero images, ready for
Johnny to approve via /dashboard → Events tab.

5 APPROVED events on /events (Local Region now shows 3 in MoVal;
Riverside events hidden behind Local Region filter — by design).

## Next steps

- Johnny approves the 7 PENDING in dashboard
- Once approved, /events will show all 10 events under "All Events"
- "Local Region" shows MoVal + Beaumont + Perris + curated regional venues
- Tomorrow morning 4:30am cron will trigger hero gen for any new IG/FB
  submissions that came in overnight

## Sources to scan next Sunday

- Same MoVal .ics feeds — check if more fall/winter events have been added
- MoVal Chamber of Commerce calendar (https://www.morenovalleychamber.com/events)
- Redlands Bowl: 2027 festival season announcements (typically posted in fall)

## Sources NOT to scan (Live Nation)

- Fox Performing Arts Center (Riverside)
- Riverside Municipal Auditorium
