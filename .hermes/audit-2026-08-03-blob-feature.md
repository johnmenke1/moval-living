# 2026-08-03 — Blob feature shipped by Emma, broken on deploy

## What Emma shipped (commit 3a9dce9, master, 2026-08-03 09:38 PDT)
- Added `logo: String?` and `coverImage: String?` to `Business` model in `prisma/schema.prisma`
- Created `src/app/api/upload/route.ts` — POST (upload) + DELETE (remove) using `@vercel/blob` `put()`
- Tier gating in route: FREE = logo+cover, FEATURED = logo+cover+up to 10 gallery photos
- Updated `EditBusinessClient.tsx` with image management UI
- Updated `src/app/business/[slug]/page.tsx` to render photo gallery
- Updated `src/app/dashboard/page.tsx` query to include `logo/tier/photos` in `select`

## What is broken
1. **Prisma 7 `include` + `select` on the same level — `src/app/dashboard/page.tsx` lines 17–34.**
   Query has `include: { business: { include: { category, reviews, _count }, select: { ... } } }`.
   Prisma 7 forbids this. Vercel log shows the error to the user.
   Fix: flatten so the `select` block is the only top-level clause on `business`, and put all the
   relations inside that `select`. No semantic change.

2. **No Prisma migration was generated or committed.** `prisma/migrations/` still only contains
   `20260729000000_add_best_of`. The schema has the new fields but the production Neon DB does NOT.
   So even after the query fix, the FIRST request to `/dashboard` that successfully executes the
   flattened query will still throw because the `logo` and `coverImage` columns don't exist in the
   production DB.
   Fix: `npx prisma migrate dev --name add_business_image_fields` (locally to generate the SQL),
   then `npx prisma migrate deploy` against production — OR `npx prisma db push` if we're not
   worried about migration history. **Do NOT `prisma db push --accept-data-loss` on a production
   DB without user confirmation.**

3. **The other places that read `logo: true`/`coverImage: true`/`photos: true`**:
   - `src/app/api/admin/best-of/categories/route.ts:18` — `business: { select: { ..., logo: true } }`
   - `src/app/api/admin/best-of/entries/[id]/refresh-gmb/route.ts:67` — same
   - `src/app/api/admin/best-of/entries/[id]/route.ts:71` — same
   - `src/app/api/best-of/entries/route.ts:66` — `select: { id: true, name: true, slug: true }` (no logo, fine)
   - `src/app/api/best-of/[categorySlug]/route.ts:25` — check
   - `src/app/api/businesses/route.ts:16` — `select: { id: true, name: true, slug: true, logo: true }`
   - `src/app/api/businesses/[slug]/route.ts` — check
   These are all `select` not `include`, so they don't violate Prisma 7 syntax. They will work
   **only after the migration is applied** (otherwise `logo` column doesn't exist).

4. **The route was tested on the route file, not end-to-end.** `canManageBusiness` is imported
   from `@/lib/business-mutations` — that exists, fine. `@vercel/blob` is in `package.json` per
   the commit. `BLOB_READ_WRITE_TOKEN` is set on Production+Preview. Should work.

## Pre-flight lesson (for my skill update)
- When user says "I want to use X" (e.g. "Vercel Blob"), the FIRST pre-flight grep should be
  the literal phrase "Vercel Blob" or "X" — not paraphrases like "upload" or "image" or "s3".
- I ran `git log --grep="upload"`, `git log --grep="image"`, `git log --grep="s3|aws|bucket"` —
  all missed commit 3a9dce9 whose message says "Vercel Blob."
- Cost: I told Johnny the feature didn't exist and offered to scope it from scratch. He said
  "yes, Vercel Blob." I was about to install `@vercel/blob` (already installed) and write a
  new route (already exists). Wasted ~3 turns of his time.

## What I will do now (in this order)
1. Fix the include/select in `src/app/dashboard/page.tsx`.
2. Run `npx prisma migrate dev --name add_business_image_fields` to generate the migration SQL.
3. Commit the migration.
4. Verify build: `npm run build` (per molly-project-collaboration SOP).
5. Verify the production DB has the columns OR explicitly tell Johnny that `prisma migrate deploy`
   needs to run against prod (he can do it via the Vercel build command OR I can offer to do it
   via a one-off `vercel env pull` + `psql` if he gives the go-ahead).
6. Update my `build-or-scope-new-feature` skill with the literal-phrase lesson.
