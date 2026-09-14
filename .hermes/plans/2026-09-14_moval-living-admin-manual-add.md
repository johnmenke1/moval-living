# moval-living — Admin Manual Business Entry

**Date:** 2026-09-14
**Owner:** Johnny
**Trigger:** "I'd like the ability to add a business by entering the details manually."

## Why

The only admin path for adding a business today is `/dashboard/add` →
Google Places search → `/api/admin/places/import`. That works for
businesses Johnny can find on Google, but it's a hard blocker for:
- Businesses Johnny knows exist but Google has wrong data for
- New businesses not yet indexed on Google
- Owner-reported additions where Johnny has the actual info in hand

## Decisions

| Question | Answer |
|---|---|
| How does admin reach the manual form? | New route `/dashboard/add/manual` (separate server component). Existing Google flow at `/dashboard/add` stays 100% untouched — zero regression risk. |
| Default status on creation? | APPROVED with a visible status dropdown (default APPROVED, admin can flip to PENDING). Mirrors the Google-import path; keeps the safety valve. |
| Image uploads? | Yes — logo + cover inline via existing `/api/upload` (logo|cover types already work for admin-owned businesses). |
| Google placeId? | Optional field. If filled, runs the same duplicate-check the import path does (`googleBusiness` is unique-ish via the import's `findFirst`). |

## Model

No schema change. Manual entries land in the existing `Business` table
with `googleBusiness` either null or the optional admin-supplied placeId.

## Files

### New
- `src/app/api/admin/businesses/manual/route.ts` — POST handler, admin-only, Zod-validated, returns 409 on duplicate slug/placeId.
- `src/app/dashboard/add/manual/page.tsx` — server component. Loads categories (matching the existing `/dashboard/add` pattern), gates on admin role, renders the client form.
- `src/components/admin/ManualAddBusinessClient.tsx` — client form. Fields: name, slug (auto-derived, editable), categoryId, tagline, description, address, city, state, zip, phone, email, website, facebook, instagram, yelp, hours, latitude, longitude, logo, coverImage, status (PENDING|APPROVED), tier (FREE|FEATURED|EXPERT_PARTNER), isExpertPartner, expertPartnerSlug, seHablaEspanol, chamberMember, hispanicChamberMember, googleBusiness (optional).

### Modified
- `src/app/dashboard/page.tsx` — admin sidebar: add a sub-section "Add Business" with two links (`/dashboard/add` for Google import, `/dashboard/add/manual` for manual). Mirrors the existing "Submit" navigation grouping.

### Unchanged
- `/dashboard/add` and `/api/admin/places/import` — left exactly as-is.
- `Business` schema — no migration needed.

## Routes summary

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/dashboard/add` | admin | Google Places importer (existing) |
| POST | `/api/admin/places/import` | admin | Create from Google Place (existing) |
| GET | `/dashboard/add/manual` | admin | Manual entry form (new) |
| POST | `/api/admin/businesses/manual` | admin | Create from manual form (new) |

## Validation (Zod schema for POST)

Mirror the existing `businessUpdateSchema` from `src/lib/business-mutations.ts` as the base, but:
- Make `name`, `address`, `city`, `state`, `zip`, `description`, `categoryId` required (the legacy update schema treats them as optional updates).
- Add `status` enum: `'PENDING' | 'APPROVED' | 'REJECTED'`. Default `'APPROVED'`.
- Add `tier` enum: `'FREE' | 'FEATURED' | 'EXPERT_PARTNER'`. Default `'FREE'`.
- `slug`: optional. If omitted, auto-derived from name via the same `nanoid(6)` suffix pattern the import route uses.
- `googleBusiness`: optional string. If present, `findFirst({ where: { googleBusiness } })` — return 409 if exists.

## Image upload pattern

Reuses the existing `/api/upload` `logo` + `cover` types. The form:
1. User picks logo file → `POST /api/upload` (type=logo) → `{ url }`
2. User picks cover file → `POST /api/upload` (type=cover) → `{ url }`
3. Submit → `POST /api/admin/businesses/manual` with both URLs in the JSON body

Same pattern as `EditBusinessClient` lines 125-145. The server route does NOT re-verify ownership (admin can manage any business), but it DOES require the admin session.

## UI patterns

Match `EditBusinessClient` field layout — same inputs, same validation toast, same error highlighting. The only deltas:
- Status + tier dropdowns near the top (not in `EditBusinessClient` which always assumes "edit existing approved business")
- No "Back to Dashboard" link at top — replace with "Cancel" inline in the form (this is a creation flow, not an edit)
- Success toast + redirect to `/business/[slug]` after creation

## Verification plan

1. `pnpm tsc --noEmit` — should be clean (per project memory, tsc actually works in this codebase on this device).
2. `pnpm next build --webpack` — confirm new route registers as dynamic (`ƒ /dashboard/add/manual`).
3. Manual smoke:
   - Admin opens `/dashboard/add/manual`, fills minimal fields (name, category, address), submits → lands on `/business/[slug]`.
   - Same form with `googleBusiness` set to a known existing placeId → 409.
   - Same form with `status=PENDING` → business exists but doesn't appear on `/search` or category pages.

## Rollback

Pure additive change. To revert: delete the three new files + revert the sidebar tweak in `/dashboard/page.tsx`. No DB impact.

## Out of scope

- Bulk CSV import (would be a separate `POST /api/admin/businesses/bulk` if you ever want it).
- Auto-geocoding from address → lat/lng (manual entry currently accepts lat/lng as numeric fields; admin can paste from Google Maps).
- Hours JSON editor (the form reuses the same 7-day `<input>` grid as `EditBusinessClient`; if you want a fancier hours editor, that's a separate feature).
- Linking the manually-added business to an owner email (admin can do that later via the existing claim flow at `/claim`).
