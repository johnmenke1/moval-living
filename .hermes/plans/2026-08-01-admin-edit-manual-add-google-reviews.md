# Admin Edit + Manual Add + Google Reviews Refresh + Best-Of Badge

**Date:** 2026-08-01 (Saturday)
**Session:** Slack, molly profile, group C0BJZAK9ZMX
**Trigger:** Johnny (ADMIN, john@menke.re) wants to:
1. Edit any site (esp. category)
2. Pull Google reviews for sites missing a Place ID
3. Fix "string did not match the expected pattern" error on add
4. Add a business to a category AND create new categories from admin
5. Show a Best-Of badge on the business listing across the site

**Scope clarification needed before build:**
- "Add to category" = change categoryId only (drop-down) OR also create
  new categories from admin panel (separate CRUD)?
- "Badge across the site" = which badge? Best-Of, Featured, Locally Owned,
  Claimed, or all-of-the-above? "Best-Of" assumed by default since that's
  the new feature. The others already exist in some surfaces.

---

## What we found (the truth, not the assumption)

### Current state of `master` (HEAD = `6560a25 feat(best-of): scoring schema, admin tab, vertical seed`)

- **507 approved businesses** in prod; **503 have a `googleBusiness` Place ID, 4 don't.**
- **Johnny IS `role: ADMIN`** in `Owner` table.
- Admin route `/api/admin/businesses/[id]` exists, but is **moderation-only** — it
  accepts only `{ status: 'APPROVED' | 'REJECTED' }` and **no general field edits**.
  It does NOT let admin change a business's `categoryId`, `name`, `address`, etc.
- The general edit endpoint `/api/businesses/[slug]` PUT already authorizes admins
  via `canManageBusiness(actor, ownerId)` → returns `true` for ADMIN. **But there is
  no admin UI that calls this PUT for a business other than your own.** The
  `/dashboard/edit` page only loads `owner.business` from the session owner.
- The `BusinessesModeration` panel only offers Approve / Reject / Delete — no
  "Edit" button. No way for Johnny to navigate to the edit UI for any business
  except his own.
- `/dashboard/add` is **Google Places import only**. There is **no manual site
  creation path for admins** at all. Public `/submit` is the only manual-create
  path; it lands in `PENDING` and is not admin-bypassable.
- `/api/businesses/[slug]/google-reviews?refresh=true` already exists, requires
  admin or owner, and **only works for businesses with a `googleBusiness` ID**.
  For the 4 sites without one, it returns `400: No Google Business ID for this
  listing`.
- `EditBusinessClient` already calls this refresh endpoint after save when
  `business.googleBusiness` is set. So that wiring is done — just needs admin
  access.

### The "string did not match the expected pattern" error

- **Not** from `places/import` admin route (no Zod there).
- **Not** from public `/submit` POST (no Zod there either).
- **Is** from Zod's `businessUpdateSchema` (`lib/business-mutations.ts`),
  triggered via the edit PUT route. Most likely culprits:
  - `zip` regex: `/^\d{5}(?:-\d{4})?$/` — the strict US ZIP
  - `state` length-2 — fine for CA but worth checking
  - `description` min-50 — fine if he wrote a real one
- The server catches `ZodError` and returns generic `'Please check the listing
  fields and try again.'`. So the **raw "string did not match the expected
  pattern"** message Johnny saw was almost certainly from the **browser DevTools
  console** or a Next.js dev overlay — the user-facing toast said something else.
- Most likely cause: Johnny was editing a manually-added business whose `zip` is
  in a Google-formatted address like `"92557, USA"` and the client sent that
  intact instead of `92557`. Or a non-CA zip. We don't actually know without
  inspecting the failing request payload — Johnny will need to share it, OR I
  reproduce.

### Google reviews refresh for manual sites

The 4 sites without a Google Place ID can't be refreshed — they have no ID. To
fix that we need an admin-side flow:
1. Admin opens a business
2. Admin pastes Google Place ID OR searches Google Places for the business
3. We save it as `googleBusiness` and call the existing refresh endpoint

This is **not** the same as Google auto-import (which sets the ID at creation).
We need a separate admin action that sets `googleBusiness` on an existing
business, then triggers the reviews refresh.

---

## The plan (3 changes, kept tight)

### Change 1 — Admin "Edit" entry point in the moderation panel

**File:** `src/components/admin/BusinessesModeration.tsx`

- Add an "Edit" button next to Approve / Reject / Delete in each business row
  (both PENDING and APPROVED).
- Button navigates to a new admin edit route (see Change 2).
- Add a second action: "Best-Of" toggle visible on the row (or inline in the
  edit form) so admins can tag/untag without opening the full edit.
- Keep existing actions intact.

### Change 1b — Category management (admin CRUD)

**New files:**
- `src/app/admin/categories/page.tsx` — admin-only list of all categories
  with add/edit/delete actions.
- `src/app/admin/categories/CategoryManager.tsx` — client component with
  the form. Fields: name, slug (auto-derived from name, editable),
  description, icon (Lucide name picker — a select with the same icons
  used in seed), image (optional URL).
- `src/app/api/admin/categories/route.ts` — GET (list, admin), POST (create).
- `src/app/api/admin/categories/[id]/route.ts` — PUT (update), DELETE.

**Safeguards for DELETE:**
- Refuse if any business is currently using the category (return 409 with
  the count and the option to reassign in the UI).
- Otherwise delete. Cascade is NOT set in the schema so this is the right
  behavior — protect FK integrity.

**Wire-up:**
- `BusinessesModeration` gets a new "Manage Categories" button in its header
  (alongside the existing filters) that links to `/admin/categories`.
- Category dropdowns in `EditBusinessClient` and the new admin edit form
  stay live (no caching) so newly created categories show up immediately.

### Change 1c — Best-Of badge shown across the site

**Where the badge needs to appear:**

| Surface | Component | Currently shows? |
|---|---|---|
| Directory card (home, search, deals) | `BusinessCard.tsx` | Featured + Deal only |
| Business detail page header | `app/business/[slug]/page.tsx` | Featured only |
| Category page | TBD | Not surveyed — TODO |
| Best-Of public page | `app/best-of/[slug]/page.tsx` (probably exists) | Inherently on it |
| Search filters | `SearchFilters.tsx` | N/A (filter, not badge) |
| Social posts linking to business | `components/social/*` | Not surveyed — TODO |

**Logic:** A business qualifies for the "Best Of" badge when:
- `bestOfEligible: true`
- AND `bestOfCategoryId` is set to an active `BestOfCategory`

**Where to put it:**

- `BusinessCard.tsx` — add a third badge (alongside Featured + Deal). Use
  `Trophy` lucide icon and the Best-Of category name as tooltip. Position:
  below or beside the Featured badge. Color: distinct from Featured's
  accent yellow — I'm thinking cobalt/teal so Featured stays the premium
  highlight.
- `app/business/[slug]/page.tsx` — add a "Best of [Category] in Moreno
  Valley" pill in the header chip row, distinct from the Featured star.
  Link it to `/best-of/[category-slug]` so visitors can see where this
  business ranks.
- Category pages + social posts — out of scope for this pass unless they
  already render `BusinessCard`. Verify in build.

**Edge case:** Featured + Best-Of on same business. Both badges must show.
Order them with the more "earned" one (Best-Of) first so the badge feels
like an editorial distinction, Featured second as the paid tier.

**Data plumbing:** The `Business` type on the card currently doesn't include
`bestOfEligible` or `bestOfCategoryId`. Need to add them to:
- `BusinessCardProps` interface
- All call sites that pass `business` into the card (home, deals, search)
  — these need to include the new fields in their queries.

**Verification:** Curl `/business/[slug]` for a known best-of business
(e.g. one tagged "tacos"), confirm the badge appears. Visit home and search
pages, confirm same.

### Change 2 — New admin edit route at `/admin/businesses/[id]`

This mirrors `/dashboard/edit` but takes any business id (or slug) and is admin-only.

**New files:**
- `src/app/admin/businesses/[id]/page.tsx` — server component, fetches by
  `id` (more robust than slug for admin actions since slugs can collide after
  rename), authorizes `session.user.role === 'ADMIN'`, redirects otherwise.
  Loads the business and all categories, hands to a new client component.
- `src/app/admin/businesses/[id]/AdminEditBusinessClient.tsx` — basically
  a copy of `EditBusinessClient` with:
  - Title "Edit Business (Admin)" instead of "Edit Listing"
  - Cancel button goes back to `/dashboard` instead of `/dashboard`
  - PUT hits `/api/admin/businesses/[id]` (new route, see Change 3)
- `src/app/api/admin/businesses/[id]/route.ts` — add `PUT` handler that:
  - Authorizes admin role (same guard as existing PATCH/DELETE in that file)
  - Accepts the same payload shape as the owner PUT
  - Calls `buildBusinessUpdateData` (reuse the existing Zod schema — this is
    where the pattern error gets caught cleanly with a useful message)
  - Allows ANY business (not just owner-owned) because admin can edit anyone

### Change 3 — Manual Google reviews refresh for sites without a Place ID

**Files touched:**
- `src/components/admin/BusinessesModeration.tsx` — add "Set Google ID" button
  to businesses where `googleBusiness` is null. Opens a small modal/inline form
  that searches Google Places (`/api/places/search?q=...`) and lets admin pick
  the right result. On submit, PATCH `googleBusiness` via a new admin route
  then call refresh.
- `src/app/api/admin/businesses/[id]/route.ts` — add `PUT` body field
  `googleBusiness: string | null` separately, OR a dedicated
  `setGoogleBusiness` sub-action. **Cleanest: add it to the PUT handler as an
  optional `googleBusiness` field** so it's one round-trip.

  But that pollutes the strict Zod schema. Better approach: add a separate
  PATCH variant that allows `googleBusiness` only when sent with a flag.
  Even cleaner: a new tiny endpoint
  `POST /api/admin/businesses/[id]/google-business` that accepts
  `{ placeId: string }`, validates via the existing Google Places search to
  confirm it exists, updates the field, and triggers the refresh in one call.

  Going with the new tiny endpoint.

- The existing `/api/businesses/[slug]/google-reviews?refresh=true` is the
  refresh path. After setting `googleBusiness`, the admin UI calls it.
  Optionally, the new set+refresh endpoint can do both in one shot server-side.

### Change 4 — Fix the pattern error reporting

- `src/app/api/businesses/[slug]/route.ts` PUT handler: when `ZodError` is
  caught, **return the field-level details** (path + message) instead of the
  generic message. Same for the new admin PUT route.
- This way Johnny can SEE which field failed instead of guessing. Surface in
  the client toast as the field name + issue.

### Tests

- `src/lib/business-mutations.test.ts` already exists. Extend it with:
  - ZIP `92557` → passes
  - ZIP `92557-1234` → passes
  - ZIP `92557, USA` → fails with clear message
  - Description 49 chars → fails
  - Description 50 chars → passes
- Add a quick `buildBusinessUpdateData` admin-mode test (no owner required).

### Verification (real, not claimed)

- `npm run build` succeeds locally
- Start dev server, log in as admin, hit each new endpoint with curl using the
  session cookie
- Verify on Vercel preview deploy:
  - Admin can navigate from `/dashboard` to a business edit page
  - Editting category saves and re-renders the row
  - Manually setting a Place ID triggers the refresh and updates
    `googleRating` / `googleReviewCount` in the DB
  - A failing PUT returns a clear field-level error, not the generic toast

---

## What I am NOT doing in this pass

- Not changing the public submit flow.
- Not changing the owner edit flow.
- Not adding a brand-new manual-add admin endpoint (the Places import already
  covers new businesses — the gap was editing, not creating).
  If Johnny wants a no-Google manual add too, we add it as a follow-up.
- Not touching the moderation flow (Approve/Reject stays as-is).

---

## Risk + unknowns

- **Unknown #1:** Johnny's exact "string did not match" reproduction. We don't
  have his payload. I will instrument the admin PUT to return field details
  so the next time it fires, we know exactly what failed.
- **Unknown #2:** Whether 4 of the 507 businesses have legitimate names but just
  bad Google data — need admin UI to fix them once Change 3 lands.
- **Risk:** The new admin PUT duplicates most of the existing owner PUT code.
  Worth it for separation of concerns (admin can edit anyone, owner can only
  edit own). If we want to consolidate, we can refactor later.
