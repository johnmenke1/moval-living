# Admin Event Editor Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Let admins (admin-only) edit any approved+published Event card from the admin dashboard — fields, dates, location, tier, hero photo — with a single Save button that writes atomically.

**Architecture:** Mirror the existing Business edit flow (`/dashboard/edit` + `EditBusinessClient` + `/api/admin/businesses/[id]`). New route `/dashboard/events/edit` (Server Component, loads Event + auth-check) renders new `EditEventClient` (Client Component, form + image upload). New API `/api/admin/events/[id]` PATCH handles the actual save in a single Prisma transaction. New "Edit Event" entry point on the EventSubmissionsPanel for APPROVED rows (and a Standalone "Events" admin tab for direct ID/slug lookup, matching the Businesses moderation pattern).

**Tech Stack:** Next.js 15 App Router (Pages already in `src/app/dashboard/edit/page.tsx`), NextAuth v5 (`auth()`), Prisma 7 (`@prisma/client`), Zod for API validation, `@vercel/blob/put` for hero uploads, Tailwind + lucide-react (matches existing editor style).

---

## Current Context (verified 2026-08-15)

| fact | source |
|---|---|
| 52 HS sports Events, all APPROVED, all tier STANDARD, all venueTag OTHER, all category SPORTS | `node .hermes/inspect-hs-sports.mjs` |
| `Event` model has fields: title, description, startsAt, endsAt, venueName, venueTag, category, address, city, state, zip, heroImageUrl, ticketUrl, isFree, tier, source, sourceUrl | `prisma/schema.prisma:314-351` |
| `EventTier` enum: STANDARD \| HONORABLE_MENTION \| HERO | `prisma/schema.prisma:251-255` |
| `EventCategory` enum: SPORTS \| MUSIC \| ARTS \| EDUCATIONAL \| FUNDRAISERS \| COMMUNITY \| FAMILY \| FOOD_DRINK \| HOLIDAY_CELEBRATIONS | `prisma/schema.prisma:257-267` |
| `VenueTag` enum: FOX_RIVERSIDE ... MOVAL_HIGH_SCHOOL ... OTHER | `prisma/schema.prisma:237-249` |
| Existing admin tabs (Businesses, Social, Events, BestOf, Nominations, GuestAuthors, GuestPosts, Audits, Diagnostics) | `src/app/dashboard/AdminTabs.tsx` |
| EventSubmissionsPanel has APPROVED rows but NO edit link — current text says "Edit the event from the public Events page" which is a lie | `src/components/admin/EventSubmissionsPanel.tsx:445-450` |
| Business edit pattern: page → component → API | `src/app/dashboard/edit/page.tsx` → `src/components/business/EditBusinessClient.tsx` → `src/app/api/admin/businesses/[id]/route.ts` |
| Existing POST `/api/upload` is business-scoped (requires businessId+type) — needs a parallel event-scoped endpoint | `src/app/api/upload/route.ts` |
| Existing admin/events endpoints: `apply-promo-images`, `generate-poster`, `regenerate-hero` — none accept PATCH for metadata | `src/app/api/admin/events/*` |

## Assumptions

- **Admin-only** (confirmed by user). No venue-owner claim flow. Reject the request if `session.user.role !== 'ADMIN'`.
- **Permission gate = role check** at the page and API. Same pattern as `EditBusinessPage` does for admin-on-behalf edits.
- **Slug is immutable post-approval.** Changing the slug would break inbound links and is not what the user asked for. Out of scope.
- **Source capture fields stay read-only** (`source`, `sourceUrl`, `sourceAuthorHandle`, `sourceAuthorUrl`, `sourcePostExcerpt`, `originatingSubmissionId`, `reviewedById`, `reviewedAt`). These are the import lineage. Editing them would break provenance.
- **No publish/unpublish toggle.** The Event model has no `status` field; visibility is "if it exists, it's on the page." A "hide" toggle is YAGNI for this slice.
- **Image upload via existing Vercel Blob pattern** — new POST endpoint `/api/admin/events/upload-hero` that mirrors `/api/upload` but is event-scoped and admin-gated.

---

## Proposed Approach

Five files to create, two to modify:

| Kind | Path | Purpose |
|---|---|---|
| Create | `src/app/dashboard/events/edit/page.tsx` | Server Component: auth-check, load Event, server-action redirect |
| Create | `src/components/admin/EditEventClient.tsx` | Client Component: form, image upload, save handler |
| Create | `src/app/api/admin/events/[id]/route.ts` | PATCH handler: Zod-validate, write Event in a transaction |
| Create | `src/app/api/admin/events/upload-hero/route.ts` | POST handler: admin-only, single hero image upload to Vercel Blob |
| Create | `src/components/admin/EventsAdminPanel.tsx` | New tab content: list ALL events with edit link (parallel to BusinessesModeration) |
| Modify | `src/app/dashboard/AdminTabs.tsx` | Add new 'events-admin' tab ↔ Tabs map ↔ panel switch |
| Modify | `src/app/dashboard/page.tsx` | Pass `events` prop to `AdminTabs` |

The **EditEventClient** will support these fields (per user's "Core + tier + venue/location" choice):

| Group | Field | Control |
|---|---|---|
| Core | title | text input |
| Core | description | textarea (markdown-lite, paragraphs preserved) |
| Core | startsAt | `<input type="datetime-local">` |
| Core | endsAt | `<input type="datetime-local">` (nullable) |
| Core | isFree | checkbox |
| Core | ticketUrl | text input (URL) |
| Tier | tier | radio: STANDARD / HONORABLE_MENTION / HERO |
| Venue / location | venueName | text input |
| Venue / location | venueTag | select (VenueTag enum) |
| Venue / location | category | select (EventCategory enum) |
| Venue / location | address | text input |
| Venue / location | city | text input |
| Venue / location | state | text input (2 chars) |
| Venue / location | zip | text input |
| Media | heroImageUrl | preview + upload button + clear |
| Read-only | slug, source, sourceUrl, createdAt, updatedAt | display only |

**Validation** (server-side, Zod):
- `title` 1–200 chars
- `startsAt` valid ISO datetime
- `endsAt` if present, must be > `startsAt`
- `venueTag` / `category` / `tier` valid enum
- `ticketUrl` if present must be valid URL
- `state` 2 chars, `zip` 5 or 9 digits

**One Save button.** All fields serialize to JSON, PATCH to `/api/admin/events/[id]`. Server uses `prisma.event.update()` with the validated payload. No batching, no partial save — atomic.

**Image upload** is a separate `POST /api/admin/events/upload-hero` that returns the blob URL, then the client sets a local `heroImageUrl` state and that gets sent in the PATCH. The pattern is `EditBusinessClient`'s: upload first, then on success save the form.

---

## Step-by-Step Plan

### Task 1: Create the Edit-Event server page (auth + load)

**Files:**
- Create: `src/app/dashboard/events/edit/page.tsx`

**Step 1:** Write the page. It mirrors `src/app/dashboard/edit/page.tsx` but for Event. Reads `eventId` (or `id`) from `searchParams`, admin-only, loads the Event with everything we need, redirects to `/dashboard` if not found or not admin.

```tsx
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import EditEventClient from '@/components/admin/EditEventClient'

export default async function EditEventPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const session = await auth()
  const { id } = await searchParams

  if (!session?.user?.id) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  if (!id) {
    // No id → show a picker? Easier: redirect to the events-admin tab.
    redirect('/dashboard?tab=events-admin')
  }

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true, slug: true, title: true, description: true,
      startsAt: true, endsAt: true,
      venueName: true, venueTag: true, category: true,
      address: true, city: true, state: true, zip: true,
      heroImageUrl: true, ticketUrl: true, isFree: true, tier: true,
      source: true, sourceUrl: true, createdAt: true, updatedAt: true,
    },
  })

  if (!event) redirect('/dashboard')

  return (
    <EditEventClient
      event={{
        ...event,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt?.toISOString() ?? null,
        createdAt: event.createdAt.toISOString(),
        updatedAt: event.updatedAt.toISOString(),
      }}
    />
  )
}
```

**Step 2:** Verify the page renders without crashing — `pnpm build` should compile (we'll catch at end). No DB write yet.

**Step 3:** Commit: `feat(admin): add edit-event page with admin gate`

---

### Task 2: Create the EditEventClient component (form skeleton)

**Files:**
- Create: `src/components/admin/EditEventClient.tsx`

**Step 1:** Type the `Event` shape and component props. State for each editable field, single `saving` flag, `error`/`success` strings, `fieldErrors` map for per-field errors, `heroImageUrl` local state.

**Step 2:** Render the form. Use the same Tailwind classes as `EditBusinessClient` so the UI feels native. Group fields into "Core", "Tier", "Venue / Location", "Media" with section headers (use `h2 text-lg font-bold text-text`).

**Step 3:** Build the `update(field, value)` helper that mirrors `EditBusinessClient`'s pattern (clear field error on edit, mark `saved = false`).

**Step 4:** Stub the `handleSubmit` to DO NOT call the API yet — just `setSaving(true)` and `setSaving(false)` after 1s. We'll wire the fetch in Task 4.

**Step 5:** Render the page (Task 1) in a browser. Confirm form fields appear, no TS errors.

**Step 6:** Commit: `feat(admin): edit-event client form skeleton`

---

### Task 3: Create the hero image upload POST endpoint

**Files:**
- Create: `src/app/api/admin/events/upload-hero/route.ts`

**Step 1:** Copy the structure of `src/app/api/upload/route.ts`. Differences:
- Admin-only gate (not business-owner)
- Accept `eventId` field instead of `businessId`
- Path the blob under `events/{eventId}/hero-{timestamp}.{ext}` so it's tenant-scoped
- Return `{ url }` on success

**Step 2:** Test in isolation: `curl -X POST` with a small file + dummy eventId → expect 401 (no auth) since cron-mode can't easily fake auth. Verify the file structure compiles via `pnpm build`.

**Step 3:** Commit: `feat(admin): event hero image upload endpoint`

---

### Task 4: Create the PATCH API route for event metadata

**Files:**
- Create: `src/app/api/admin/events/[id]/route.ts`

**Step 1:** Define the Zod schema (mirror the validation rules from "Validation" above). All fields except `heroImageUrl` and `description` are required-to-stay-truthy (e.g. `title` cannot be empty string); `endsAt`, `ticketUrl`, `address`, `city`, `state`, `zip`, `heroImageUrl`, `description` are optional/nullable.

**Step 2:** Write the handler:

```ts
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await ctx.params
  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ fields: parsed.error.flatten().fieldErrors, error: 'Validation failed' }, { status: 400 })
  }
  const data = parsed.data

  // Verify event exists
  const existing = await prisma.event.findUnique({ where: { id }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

  const updated = await prisma.event.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description ?? null,
      startsAt: new Date(data.startsAt),
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      isFree: data.isFree,
      ticketUrl: data.ticketUrl || null,
      tier: data.tier,
      venueName: data.venueName || null,
      venueTag: data.venueTag,
      category: data.category ?? null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      zip: data.zip || null,
      heroImageUrl: data.heroImageUrl || null,
    },
  })

  return NextResponse.json({ ok: true, event: { id: updated.id, slug: updated.slug, updatedAt: updated.updatedAt.toISOString() } })
}
```

**Step 3:** Wire the `handleSubmit` in `EditEventClient` to fetch this endpoint with the form payload. On success, show "Saved ✓" toast and `router.refresh()`. On validation error, populate `fieldErrors` from the server's `fields` object.

**Step 4:** Manual test: edit an event in the browser, change the title, save, refresh `/events` and verify the new title persists.

**Step 5:** Commit: `feat(admin): event PATCH endpoint with zod validation`

---

### Task 5: Wire image upload to the form

**Files:**
- Modify: `src/components/admin/EditEventClient.tsx`

**Step 1:** Add a `handleHeroUpload(file: File)` that:
- POSTs to `/api/admin/events/upload-hero` with `FormData({ file, eventId })`
- Sets `heroImageUrl` state to the returned URL
- Shows a spinner while uploading

**Step 2:** Add a "Clear" button next to the hero preview that nullifies `heroImageUrl` (sends `null` in the PATCH).

**Step 3:** Manual test: upload a 1MB JPEG, save the form, refresh the public events page, verify the new image is showing.

**Step 4:** Commit: `feat(admin): event hero image upload in editor`

---

### Task 6: Add the "Events Admin" tab and entry points

**Files:**
- Modify: `src/app/dashboard/AdminTabs.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Create: `src/components/admin/EventsAdminPanel.tsx`

**Step 1:** In `page.tsx`, add a `prisma.event.findMany({ orderBy: { startsAt: 'desc' }, take: 200, select: { id, slug, title, startsAt, venueName, tier, category } })` and pass to `AdminTabs` as `events`.

**Step 2:** Add `'events-admin'` to `TabKey` and to the `TABS` array in `AdminTabs.tsx`, with a `Calendar` icon (already imported). Wire it to render `<EventsAdminPanel events={events} />`.

**Step 3:** Build `EventsAdminPanel.tsx`: a compact table with columns slug · title · startsAt · venue · tier · actions(Edit). "Edit" links to `/dashboard/events/edit?id={event.id}`.

**Step 4:** Also wire the existing `EventSubmissionsPanel`: for `status === 'APPROVED'` rows, add a "Edit event" link next to the success message that goes to the same `/dashboard/events/edit?id={event.eventId}` — but the current panel only has `Submission` data, not the linked Event id. Look up `promotedToEventId` from the Submission and pass it through. If `promotedToEventId` is null, show "Edit event" but link to the admin tab with a search.

**Step 5:** Manual test: open `/dashboard`, switch to Events tab, click "Edit" on a row, save changes, see them on `/events`.

**Step 6:** Commit: `feat(admin): events admin tab with edit links`

---

### Task 7: Validate end-to-end

**Tests:**
1. Open `/dashboard/events/edit?id={eventId}` for one HS sports event.
2. Change tier from STANDARD → HONORABLE_MENTION.
3. Change title from "MVHS Football vs Lakeside" to "Moreno Valley High vs Lakeside — Football".
4. Upload a new hero image.
5. Click Save — toast says "Saved ✓".
6. Reload `/events` — verify tier badge / title / hero image all updated.
7. Open DevTools Network → /api/admin/events/[id] PATCH returns 200 with `{ ok: true, event: { ... } }`.
8. Try `/dashboard/events/edit?id={notRealId}` → redirects to `/dashboard`.
9. Sign in as non-admin → `/dashboard/events/edit?id=...` → redirects to `/dashboard`.
10. Submit invalid `endsAt` (before `startsAt`) → server returns 400 with `fields: { endsAt: ['...'] }`, the form highlights the `endsAt` field red.

**Commit:** `chore(admin): smoke-test event editor`

---

## Risks & Tradeoffs

| Risk | Mitigation |
|---|---|
| `tier` change has SEO/rendering impact (HERO cards occupy hero slots on the public page) | Out of scope to add a "max HERO count" cap; user can review visually. Note in changelog. |
| Editing `startsAt` on a past event orphans it from "this week" views | Acceptable — admin knows what they're doing. |
| Image upload goes through Vercel Blob — adds cost per upload | Same pattern as Business editor; existing billing already covers. |
| `next.config.ts` may have remote image domains that don't include the new blob hostname | Verify the existing `EditBusinessClient` reuses the same domain (it does) — no change needed. |
| Deep link to `/dashboard/events/edit?id=X` accepted without `?id` query | Handled: redirect to `/dashboard?tab=events-admin` (Task 1). |
| The 200-event limit in Task 6 hides old events from the admin tab | Acceptable for first cut; can add pagination later. YAGNI. |
| `EventCategory` enum has no `null`-handling for legacy rows | Schema already says `category: EventCategory?` (nullable). PATCH passes `null` when "no category" is selected. |

## Open Questions

1. **Should the editor also let admin promote/demote the originating `Submission` (e.g. UNLINK from a duplicate)?** Out of scope; user asked for editing the event, not the submission. Can be a follow-up.
2. **Should edits write to an `EventAudit` log?** We have an `AuditsPanel` tab. Adding a new audit type is YAGNI for this slice — the `updatedAt` field is sufficient for now. Flag in memory if you want to add audit later.

## Files Likely to Change

- Create: `src/app/dashboard/events/edit/page.tsx`
- Create: `src/components/admin/EditEventClient.tsx`
- Create: `src/app/api/admin/events/[id]/route.ts`
- Create: `src/app/api/admin/events/upload-hero/route.ts`
- Create: `src/components/admin/EventsAdminPanel.tsx`
- Modify: `src/app/dashboard/AdminTabs.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/components/admin/EventSubmissionsPanel.tsx` (add Edit link to APPROVED rows)

## Tests / Validation

- Manual browser test of all 7 field groups (Core, Tier, Venue, etc.) — Task 7.
- TS compile via `pnpm build` — final pass.
- Lint via `pnpm lint` (Next.js default) — no new warnings.
- Live DB write: pick one HS sports event, make a change, refresh `/events`, confirm.

## Execution

Plan complete. Ready to execute. Tasks are sized for a single orchestrator with seriated subagents (one per task). Suggest keeping the `pnpm build` check at the end of every task to catch type errors early.
