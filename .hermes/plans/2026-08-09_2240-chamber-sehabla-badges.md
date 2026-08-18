# Chamber + Se Habla Español Badges — Implementation Plan

> **For Hermes:** Execute with discipline. Pre-flight checklist before `prisma db push` is mandatory (live DB has 10+ columns the local schema is missing). Use subagent-driven-development per task if delegating.
>
> **2026-08-09 revision:** Johnny picked Option B — collect the three fields during the claim flow (`/claim`) before redirecting to dashboard. Adds a new Task 7.5 (between old Task 7 and old Task 8). All subsequent task numbers bumped +1.

**Goal:** Add three new boolean fields to `Business` (`chamberMember`, `hispanicChamberMember`, `seHablaEspanol`) and render them as badges on the business card, the business detail page, AND the admin moderation panel. Owners can toggle them during claim and from their edit form; admins can set them manually.

**Architecture:**
- Three new `Boolean @default(false)` columns on `Business`. Pure display badges — no behavior change, no scoring impact yet (search/filter integration is a follow-up).
- One small, reusable `<ChamberBadge>` component (mirrors the existing `ExpertPartnerBadge` pattern: pure helper + JSX). Renders nothing when the boolean is false — safe to drop in any surface.
- Two new surfaces (card + detail page) per the architecture rule from `tier-and-bestof-architecture-2026-08-09.md`: badges live in **photo overlay** (small pill) AND **header row below name** (inline chip) for the detail page; card uses the existing single badge row below the photo.
- Owner-edit path uses the existing `buildBusinessUpdateData` `Zod` allowlist (`.strict()`) — extend it, don't bypass it. Submit-form path uses the manual POST (no Zod) — just plumb the fields through. Claim path uses the same `PUT /api/businesses/[slug]` route as edit — same allowlist.
- Admin manual path uses the existing `PATCH /api/admin/businesses/[id]` route — extend the `Zod` schema.

**Tech Stack:** Next.js App Router · NextAuth · Prisma + Postgres (Neon) · Tailwind · Lucide icons · Zod 4

---

## Critical Pre-Flight (DO THIS FIRST)

Live DB has 53 columns on `Business`. Local `schema.prisma` is missing: `isExpertPartner`, `expertPartnerSlug`, `foundingPartnerSince`, `liveQaZoomUrl`, `liveQaNextDate`, `ghlCompanyId`, `foundingPartnerRate`, `ghlLocationId`, `submitterEmailOptIn`, `submitterSmsOptIn`, `submitterConsentAt`, `coupon`, `hasCoupon`, `googleRating`, `googleReviewCount`, `stripeCustomerId`, `claimToken`, `claimExpiresAt`, `stripeSubscriptionId`, `subscriptionStatus`, `subscriptionCurrentPeriodEnd`, `bestOfTags`, `isBestOfWinner`. Pushing the local schema naively would drop all those columns → silent data loss.

**Approach: write a migration by hand, only adds the 3 new columns. Do NOT use `prisma db push` for this.** This is the documented `destructive-prisma-push` skill exception: hand-write the migration only because the live DB has drift from prior agent commits AND we want a guaranteed additive-only forward path. Then `prisma migrate deploy` to apply.

**Before applying any migration, verify the patch landed:**

```bash
grep -c "chamberMember\|hispanicChamberMember\|seHablaEspanol" prisma/schema.prisma
# expect: ≥ 3
grep -c "isExpertPartner" prisma/schema.prisma
# expect: ≥ 1 (column declaration still present)
```

The `destructive-prisma-push` skill documents the patch-silent-noop failure mode on this project. Verify EVERY step.

---

## Files Likely to Change

| File | Change |
|---|---|
| `prisma/schema.prisma` | +3 fields on `Business` |
| `prisma/migrations/20260810000000_add_chamber_and_sehabla/migration.sql` | NEW — additive ALTER TABLE |
| `src/lib/chamber-display.ts` | NEW — pure helper (no prisma) |
| `src/components/business/ChamberBadge.tsx` | NEW — pure JSX, browser-safe |
| `src/components/business/BusinessCard.tsx` | Wire 3 badges into existing badge row |
| `src/app/business/[slug]/page.tsx` | Wire 3 badges into header row + cover overlay |
| `src/components/business/EditBusinessClient.tsx` | Add 3 checkboxes; ship via PUT |
| `src/lib/business-mutations.ts` | Add 3 fields to `businessUpdateSchema` + builder |
| `src/app/api/businesses/route.ts` | Accept 3 fields on POST (submit) |
| `src/app/submit/page.tsx` | Add 3 checkboxes (Step 7) |
| `src/app/api/admin/businesses/[id]/route.ts` | Add 3 fields to allowlist Zod |
| `src/components/admin/BusinessesModeration.tsx` | Add 3 checkboxes to the edit modal |
| `src/app/claim/ClaimPageClient.tsx` | Add 3-checkbox section below the password field |
| `src/app/claim/complete/page.tsx` | Apply the three flags via `buildBusinessUpdateData` after the claim succeeds |
| `src/lib/business-mutations.test.ts` | Extend test for the 3 new fields |

---

## Step-by-Step Plan

### Task 1: Schema additions

**Objective:** Add the three new boolean fields to `Business` in the local schema and to the live DB.

**Files:**
- Modify: `prisma/schema.prisma` (add 3 lines near the `Expert Partner` block)
- Create: `prisma/migrations/20260810000000_add_chamber_and_sehabla/migration.sql`

**Step 1.1 — Edit schema.** Use `patch` (not `write_file`) to append the three fields next to the `// Expert Partner program` block. Anchor on a unique nearby line:

```prisma
  // Chamber affiliations (manual or claim-checkbox; rendered as card badges)
  chamberMember          Boolean   @default(false)
  hispanicChamberMember  Boolean   @default(false)
  seHablaEspanol         Boolean   @default(false)
```

**Step 1.2 — Verify the patch landed** (critical, see pre-flight):

```bash
grep -n "chamberMember\|hispanicChamberMember\|seHablaEspanol" prisma/schema.prisma
grep -n "isExpertPartner" prisma/schema.prisma   # confirm no regression
```

**Step 1.3 — Write the migration by hand.** Plain `ALTER TABLE` for the three columns. No drops. No backfill (defaults handle it):

```sql
-- AlterTable
ALTER TABLE "Business" ADD COLUMN "chamberMember" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Business" ADD COLUMN "hispanicChamberMember" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Business" ADD COLUMN "seHablaEspanol" BOOLEAN NOT NULL DEFAULT false;
```

Save as `prisma/migrations/20260810000000_add_chamber_and_sehabla/migration.sql`.

**Step 1.4 — Apply.** From `C:\projects\websites\moval-living`:

```bash
set -a && source .env.local && set +a && npx prisma migrate deploy
```

Expected: 1 migration applied, no destructive warnings.

**Step 1.5 — Verify DB columns exist:**

```bash
cd /c/projects/websites/moval-living
set -a && source .env.local && set +a
node -e '
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 AND column_name IN ($2,$3,$4) ORDER BY column_name`, ["Business","chamberMember","hispanicChamberMember","seHablaEspanol"]);
  console.log("Found:", cols.rows.map(r => r.column_name));
  await c.end();
})();
' 2>&1 | grep -v "Warning\|SECURITY\|getaddrinfo\|SSL modes\|libpq"
```

Expected: `Found: [ 'chamberMember', 'hispanicChamberMember', 'seHablaEspanol' ]`

**Step 1.6 — Regenerate Prisma client:**

```bash
npx prisma generate
```

**Step 1.7 — Commit:**

```bash
git add prisma/schema.prisma prisma/migrations/20260810000000_add_chamber_and_sehabla/
git commit -m "feat: add chamber + se habla espanol fields to Business"
```

---

### Task 2: Pure helpers + badge component

**Objective:** Build the reusable `<ChamberBadge>` component using the same pattern as `ExpertPartnerBadge` (pure helper + JSX, no Prisma).

**Files:**
- Create: `src/lib/chamber-display.ts`
- Create: `src/components/business/ChamberBadge.tsx`

**Step 2.1 — `src/lib/chamber-display.ts`:**

```ts
export type ChamberAffiliation = {
  chamberMember: boolean
  hispanicChamberMember: boolean
  seHablaEspanol: boolean
}

export type ChamberBadge =
  | { kind: 'CHAMBER'; label: string; colorClass: string; tooltip: string }
  | { kind: 'HISPANIC_CHAMBER'; label: string; colorClass: string; tooltip: string }
  | { kind: 'SE_HABLA_ESPANOL'; label: string; colorClass: string; tooltip: string }
  | null

export function getChamberBadges(input: ChamberAffiliation): ChamberBadge[] {
  const out: ChamberBadge[] = []
  if (input.chamberMember) {
    out.push({
      kind: 'CHAMBER',
      label: 'Moreno Valley Chamber',
      colorClass: 'bg-blue-50 text-blue-800 border-blue-200',
      tooltip: 'Member of the Moreno Valley Chamber of Commerce',
    })
  }
  if (input.hispanicChamberMember) {
    out.push({
      kind: 'HISPANIC_CHAMBER',
      label: 'Hispanic Chamber',
      colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      tooltip: 'Member of the Moreno Valley Hispanic Chamber of Commerce',
    })
  }
  if (input.seHablaEspanol) {
    out.push({
      kind: 'SE_HABLA_ESPANOL',
      label: 'Se Habla Español',
      colorClass: 'bg-amber-50 text-amber-800 border-amber-200',
      tooltip: 'Spanish spoken here',
    })
  }
  return out
}
```

**Step 2.2 — `src/components/business/ChamberBadge.tsx`:**

```tsx
import { Handshake, Languages } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getChamberBadges, ChamberAffiliation } from '@/lib/chamber-display'

interface ChamberBadgeProps {
  business: ChamberAffiliation
  variant?: 'pill' | 'inline'
  className?: string
}

/**
 * Renders a row of chamber / language badges for a business.
 * Returns null if none of the three flags are set, so it's safe to drop
 * into any component without conditional checks.
 *
 * Variants:
 *   - pill: small chip suitable for listing cards (uses shadow)
 *   - inline: smaller text label for header rows (no shadow)
 */
export function ChamberBadge({
  business,
  variant = 'pill',
  className,
}: ChamberBadgeProps) {
  const badges = getChamberBadges(business)
  if (badges.length === 0) return null

  const baseClass = variant === 'pill'
    ? 'inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border shadow-sm'
    : 'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md border'

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {badges.map(b => (
        <span
          key={b.kind}
          className={cn(baseClass, b.colorClass)}
          title={b.tooltip}
        >
          {b.kind === 'SE_HABLA_ESPANOL' ? (
            <Languages className="w-3 h-3" />
          ) : (
            <Handshake className="w-3 h-3" />
          )}
          {b.label}
        </span>
      ))}
    </div>
  )
}
```

**Step 2.3 — Verify build still passes:**

```bash
npx tsc --noEmit
```

Expected: clean.

**Step 2.4 — Commit:**

```bash
git add src/lib/chamber-display.ts src/components/business/ChamberBadge.tsx
git commit -m "feat: ChamberBadge component + chamber-display helper"
```

---

### Task 3: Wire badges into BusinessCard

**Objective:** Render the chamber badges in the existing badge row on `BusinessCard.tsx` (the row already used for Best-Of + Expert Partner; add a sibling row for chamber).

**Files:**
- Modify: `src/components/business/BusinessCard.tsx`

**Step 3.1 — Extend the props interface (around line 32):** add the three boolean fields.

```ts
  chamberMember?: boolean
  hispanicChamberMember?: boolean
  seHablaEspanol?: boolean
```

**Step 3.2 — Add the badge row after the existing `(isExpertPartner || business.isBestOf) && (...)` block (around line 111).** Keep the existing row intact; add a sibling row beneath it:

```tsx
{(business.chamberMember || business.hispanicChamberMember || business.seHablaEspanol) && (
  <ChamberBadge
    business={{
      chamberMember: !!business.chamberMember,
      hispanicChamberMember: !!business.hispanicChamberMember,
      seHablaEspanol: !!business.seHablaEspanol,
    }}
    className="mb-3"
  />
)}
```

**Step 3.3 — Import the new component.** Add to the import block at the top:

```ts
import { ChamberBadge } from '@/components/business/ChamberBadge'
```

**Step 3.4 — Verify:** `npx tsc --noEmit`. Search callsites that render `BusinessCard` to confirm they include the new fields in their `select`.

**Step 3.5 — Grep for callers** to see what must be updated to select the new fields:

```bash
grep -rn "BusinessCard" src/app src/components --include="*.tsx" -l
```

Each caller that builds a `business` object literal must add the three fields. Specifically:
- `src/app/best-of/[category]/page.tsx` (Best-Of winners)
- `src/app/search/page.tsx`
- `src/app/deals/page.tsx`
- `src/components/home/HomePageClient.tsx`
- `src/app/page.tsx` (homepage)

For each, add the three fields to the `select` block (NOT `include` — schema-drift hazard) AND to the props mapping. Pattern: `chamberMember: business.chamberMember, ...` etc.

**Step 3.6 — Commit:**

```bash
git add src/components/business/BusinessCard.tsx <each caller file>
git commit -m "feat: render chamber + se habla badges on BusinessCard"
```

---

### Task 4: Wire badges into business detail page

**Objective:** Render the chamber badges on the public listing page (`/business/[slug]`) in BOTH the cover-image overlay row AND the header row below the name, per the architecture rule from `tier-and-bestof-architecture-2026-08-09.md`.

**Files:**
- Modify: `src/app/business/[slug]/page.tsx`

**Step 4.1 — Add to the `select` block (around line 48):** add the three boolean fields.

**Step 4.2 — In the helper-booleans block (around line 203):** add derived helpers:

```ts
const chamber = {
  chamberMember: !!business.chamberMember,
  hispanicChamberMember: !!business.hispanicChamberMember,
  seHablaEspanol: !!business.seHablaEspanol,
}
const hasChamberBadge = chamber.chamberMember || chamber.hispanicChamberMember || chamber.seHablaEspanol
```

**Step 4.3 — Cover-image overlay row (around line 266):** the existing `{isBestOfWinner && (<span>#1 Best Of</span>)}` block lives inside a row of pills. Add the chamber badge inline:

```tsx
{hasChamberBadge && (
  <ChamberBadge business={chamber} variant="pill" />
)}
```

Need to inspect the existing JSX to know exactly where; default assumption is the same flex-row sibling layout.

**Step 4.4 — Header row below name (around line 319):** add the inline variant:

```tsx
{hasChamberBadge && (
  <ChamberBadge business={chamber} variant="inline" />
)}
```

**Step 4.5 — Import:**

```ts
import { ChamberBadge } from '@/components/business/ChamberBadge'
```

**Step 4.6 — Verify:** `npx tsc --noEmit && npm run build`. The pre-commit-review skill's Check #9 (client component imports server-only module) does NOT apply here — `ChamberBadge` imports `chamber-display` which has zero Prisma imports. Safe for both surfaces.

**Step 4.7 — Commit:**

```bash
git add src/app/business/[slug]/page.tsx
git commit -m "feat: chamber + se habla badges on business detail page"
```

---

### Task 5: Owner-edit path (EditBusinessClient + buildBusinessUpdateData)

**Objective:** Allow owners to set the three checkboxes from their dashboard edit form.

**Files:**
- Modify: `src/lib/business-mutations.ts`
- Modify: `src/components/business/EditBusinessClient.tsx`
- Modify: `src/lib/business-mutations.test.ts`

**Step 5.1 — Extend `businessUpdateSchema` (Zod allowlist, `.strict()`).** Add three fields AFTER the existing Expert Partner block, before the closing `}).strict()`:

```ts
  chamberMember: z.boolean().optional(),
  hispanicChamberMember: z.boolean().optional(),
  seHablaEspanol: z.boolean().optional(),
```

**Step 5.2 — Extend `buildBusinessUpdateData` return block:**

```ts
    chamberMember: parsed.chamberMember,
    hispanicChamberMember: parsed.hispanicChamberMember,
    seHablaEspanol: parsed.seHablaEspanol,
```

**Step 5.3 — Extend `EditBusinessClient.tsx`:**
- Add the three fields to the `Business` interface (line 13-40).
- Add to the `FIELD_LABELS` map (line 49-70) so server validation errors surface in the toast.
- Add three new form state values inside `useState` (around line 77).
- Add the three checkboxes in the form. Recommended location: a new "Community Affiliations" section between the Deal section and the Hours section. Use the same toggle pattern as `hasCoupon` (line 630).
- Add the three fields to the PUT body (around line 217).

**Step 5.4 — Extend the test.** Add a test case in `src/lib/business-mutations.test.ts` that:
- Ships a payload with `chamberMember: true, hispanicChamberMember: false, seHablaEspanol: true`.
- Asserts the parsed `data` includes the three fields.
- Bonus: ship a payload with `chamberMember: 'yes'` (string) and assert `.strict()` rejects it.

**Step 5.5 — Run the test:**

```bash
cd /c/projects/websites/moval-living && npx vitest run src/lib/business-mutations.test.ts
```

Expected: all pass, including the new ones.

**Step 5.6 — Verify build:**

```bash
npx tsc --noEmit && npm run build
```

**Step 5.7 — Commit:**

```bash
git add src/lib/business-mutations.ts src/components/business/EditBusinessClient.tsx src/lib/business-mutations.test.ts
git commit -m "feat: owner-edit path for chamber + se habla badges"
```

---

### Task 6: Submit-form path (POST /api/businesses + /submit/page.tsx)

**Objective:** Allow submitters to check the three boxes when first submitting a business.

**Files:**
- Modify: `src/app/api/businesses/route.ts`
- Modify: `src/app/submit/page.tsx`

**Step 6.1 — `POST /api/businesses`** (around line 12): destructure the three new fields from the body.

```ts
    chamberMember, hispanicChamberMember, seHablaEspanol,
```

**Step 6.2 — Pass them into the `prisma.business.create` data block** (around line 60):

```ts
      chamberMember: !!chamberMember,
      hispanicChamberMember: !!hispanicChamberMember,
      seHablaEspanol: !!seHablaEspanol,
```

**Step 6.3 — `src/app/submit/page.tsx`:** add to the initial form state (around line 81):

```ts
    chamberMember: false,
    hispanicChamberMember: false,
    seHablaEspanol: false,
```

**Step 6.4 — Add a new "Step 6b" or extend the Deal step** (line 308) with three checkbox rows using the same toggle pattern as `hasCoupon` (line 313). Use `<input type="checkbox">` (not the toggle button) for a multi-select section. Section header: "Community Affiliations".

**Step 6.5 — Ship them in the POST body** (in the same file, where the body is constructed for `/api/businesses`):

```ts
    chamberMember: form.chamberMember,
    hispanicChamberMember: form.hispanicChamberMember,
    seHablaEspanol: form.seHablaEspanol,
```

**Step 6.6 — Verify:** `npx tsc --noEmit && npm run build`.

**Step 6.7 — Commit:**

```bash
git add src/app/api/businesses/route.ts src/app/submit/page.tsx
git commit -m "feat: submit-form path for chamber + se habla badges"
```

---

### Task 7: Admin manual path (PATCH /api/admin/businesses/[id] + moderator UI)

**Objective:** Allow admins to toggle the three flags from the moderation panel.

**Files:**
- Modify: `src/app/api/admin/businesses/[id]/route.ts`
- Modify: `src/components/admin/BusinessesModeration.tsx`

**Step 7.1 — Extend the admin Zod schema** (line 6):

```ts
const updateSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  tier: z.enum(['FREE', 'FEATURED', 'EXPERT_PARTNER']).optional(),
  categoryId: z.string().optional(),
  googleBusiness: z.string().nullable().optional(),
  googleRating: z.number().min(0).max(5).nullable().optional(),
  googleReviewCount: z.number().int().min(0).nullable().optional(),
  chamberMember: z.boolean().optional(),
  hispanicChamberMember: z.boolean().optional(),
  seHablaEspanol: z.boolean().optional(),
})
```

**Step 7.2 — Add the three fields to the `data` build block** (around line 41):

```ts
  if (parsed.data.chamberMember !== undefined) data.chamberMember = parsed.data.chamberMember
  if (parsed.data.hispanicChamberMember !== undefined) data.hispanicChamberMember = parsed.data.hispanicChamberMember
  if (parsed.data.seHablaEspanol !== undefined) data.seHablaEspanol = parsed.data.seHablaEspanol
```

**Step 7.3 — `BusinessesModeration.tsx`:** add three checkboxes to the edit modal. Pattern: read the current values from the API response, PATCH on save. The exact edit-modal structure needs inspection before patching — read the file first.

**Step 7.4 — Verify:** `npx tsc --noEmit && npm run build`.

**Step 7.5 — Commit:**

```bash
git add src/app/api/admin/businesses/[id]/route.ts src/components/admin/BusinessesModeration.tsx
git commit -m "feat: admin manual path for chamber + se habla badges"
```

---

### Task 7.5: Claim-flow checkbox (Option B — Johnny confirmed 2026-08-09)

**Objective:** Let the owner check the three Chamber/language boxes during the magic-link claim flow, so the badges render immediately on first publish instead of waiting for a dashboard-edit visit. Keep the existing single-page `/claim` form — the magic-link is the moment, don't break it with a multi-step wizard.

**Design (load-bearing):** the user clicks the magic link, lands on `/claim`, sees the existing form (first/last name, email, password), and below the password field a "Community Affiliations" section with three checkboxes. On submit, the existing flow runs (register → redirect to `/claim/complete?token=...`). The `complete` page reads the three flags from the search params and applies them via a focused `prisma.business.update` after the claim succeeds.

**State persistence:** checkbox values must survive the register POST → `/claim/complete` redirect. The complete page is a server-component that reads `searchParams`. Pass the three flags as query params on the redirect: `/claim/complete?token=...&cm=1&hc=1&se=1`.

**Risk:** search params on a magic-link URL are visible to anyone who copy-pastes the link. Mitigation: the link is single-use (consumed on first complete per the existing `updateMany` atomicity in `claim/complete/page.tsx` line 33–47). By the time a third party sees the URL, the claim is already gone. Acceptable.

**Files:**
- Modify: `src/app/claim/ClaimPageClient.tsx`
- Modify: `src/app/claim/complete/page.tsx`

**Step 7.5.1 — Add to `ClaimPageClient.tsx`:**

- Three new useState (line 22-23 area):
  ```ts
  const [chamberMember, setChamberMember] = useState(false)
  const [hispanicChamberMember, setHispanicChamberMember] = useState(false)
  const [seHablaEspanol, setSeHablaEspanol] = useState(false)
  ```

- New section below the password field (after the "Use for all future sign-ins" hint, around line 202), before the error block:
  ```tsx
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-sm font-semibold text-text mb-1">Community Affiliations</p>
    <p className="text-xs text-text-secondary mb-3">
      Check any that apply — these will show as trust badges on your listing.
    </p>
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={chamberMember} onChange={e => setChamberMember(e.target.checked)} className="rounded border-slate-300" />
        <span>Member of the Moreno Valley Chamber of Commerce</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={hispanicChamberMember} onChange={e => setHispanicChamberMember(e.target.checked)} className="rounded border-slate-300" />
        <span>Member of the Moreno Valley Hispanic Chamber of Commerce</span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={seHablaEspanol} onChange={e => setSeHablaEspanol(e.target.checked)} className="rounded border-slate-300" />
        <span>Se Habla Español — Spanish spoken here</span>
      </label>
    </div>
  </div>
  ```

- In the `router.push` to `/claim/complete` (line 78), append the three flags as '1' / '0' params:
  ```ts
  const params = new URLSearchParams({ token })
  if (chamberMember) params.set('cm', '1')
  if (hispanicChamberMember) params.set('hc', '1')
  if (seHablaEspanol) params.set('se', '1')
  router.push(`/claim/complete?${params.toString()}`)
  ```

**Step 7.5.2 — Apply flags in `src/app/claim/complete/page.tsx`:**

- After the existing `claimed` check (line 60) and BEFORE the redirect to `/dashboard`, if `claimed === true`, run a second update with the three flags:
  ```ts
  if (claimed) {
    const flags = {
      chamberMember: searchParams.cm === '1',
      hispanicChamberMember: searchParams.hc === '1',
      seHablaEspanol: searchParams.se === '1',
    }
    // Only update if any flag differs from the default (false) — saves a write.
    if (flags.chamberMember || flags.hispanicChamberMember || flags.seHablaEspanol) {
      await prisma.business.update({
        where: { id: business.id },
        data: flags,
      })
    }
  }
  ```
- Note: `searchParams` is already awaited at line 13 as `await searchParams`. Read the new fields from the resolved object.
- Source-of-truth check: this update runs AFTER the atomic claim is confirmed. The business is owned by the new user. Safe.

**Step 7.5.3 — Verify:**

```bash
npx tsc --noEmit && npm run build
```

- Cheat test: claim a business with all three boxes checked, then load `/business/<slug>` and confirm the three badges render. (Manual; not a unit test.)

**Step 7.5.4 — Commit:**

```bash
git add src/app/claim/ClaimPageClient.tsx src/app/claim/complete/page.tsx
git commit -m "feat: collect chamber + se habla flags during claim flow"
```

---

### Task 8: Use the live DB to populate Moreno Valley Chamber members (data seed)

**Objective:** Provide Johnny with a one-shot script to bulk-mark known Chamber members so the badges render on day one. NOT a code change — a CLI script committed alongside the feature.

**Files:**
- Create: `scripts/backfill-chamber-2026-08-09.mjs`

**Step 8.1 — Write the script** as a placeholder with instructions. The actual slug list comes from Johnny's spreadsheet (Open Question Q2 below). Template:

```js
// backfill-chamber-2026-08-09.mjs
// One-shot script: mark these slugs as Moreno Valley Chamber members.
// Run: node -r dotenv/config scripts/backfill-chamber-2026-08-09.mjs
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const CHAMBER_SLUGS = [
  // 'johnson-family-dental', // ← example
]

const HISPANIC_CHAMBER_SLUGS = [
  // 'taqueria-don-jose', // ← example
]

const SE_HABLA_ESPANOL_SLUGS = [
  // 'taqueria-don-jose', // ← example
]

async function main() {
  if (CHAMBER_SLUGS.length) {
    const r = await prisma.business.updateMany({
      where: { slug: { in: CHAMBER_SLUGS } },
      data: { chamberMember: true },
    })
    console.log(`chamberMember: ${r.count} updated`)
  }
  // ... same pattern for the other two
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
```

**Step 8.2 — Do NOT run** until Johnny provides the slug list (Q2). Just commit the script as a placeholder.

**Step 8.3 — Commit:**

```bash
git add scripts/backfill-chamber-2026-08-09.mjs
git commit -m "chore: placeholder backfill script for chamber badges"
```

---

### Task 9: Final verification

**Objective:** Prove end-to-end correctness.

**Step 9.1 — Build clean:**

```bash
cd /c/projects/websites/moval-living
npx tsc --noEmit && npm run build
```

Expected: 0 errors.

**Step 9.2 — Run pre-commit review** (per the `nextjs-nextauth-pre-commit-review` skill) with focus on:
- Check #3 (mass-assignment): the new fields are in `businessUpdateSchema` allowlist + admin PATCH schema. Both `.strict()`. ✓
- Check #3b (form sends extras the schema doesn't list): confirm `EditBusinessClient.tsx` ships ONLY the three flag fields plus the existing ones — no extras. Confirm the field-level error wiring works for the new fields (they're in `FIELD_LABELS`).
- Check #9 (client component imports server-only module): `ChamberBadge` imports from `chamber-display.ts` which has zero Prisma imports. Verify:

```bash
grep -rn "from ['\"]@prisma\|from ['\"]pg\|from ['\"]fs\|from ['\"]crypto" src/lib/chamber-display.ts src/components/business/ChamberBadge.tsx
```

Expected: zero matches.

**Step 9.3 — Tests pass:**

```bash
npx vitest run
```

**Step 9.4 — Live DB probe:**

```bash
cd /c/projects/websites/moval-living
set -a && source .env.local && set +a
node -e '
const { Client } = require("pg");
(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const cols = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, ["Business"]);
  console.log("Total columns:", cols.rows.length);
  const newCols = cols.rows.filter(r => ["chamberMember","hispanicChamberMember","seHablaEspanol"].includes(r.column_name));
  console.log("New columns:", newCols.map(r => r.column_name));
  // Confirm we did NOT drop any pre-existing columns
  const expected = ["isExpertPartner","foundingPartnerSince","liveQaZoomUrl","googleRating","googleReviewCount","stripeCustomerId","claimToken","hasCoupon","coupon"];
  for (const name of expected) {
    const exists = cols.rows.find(r => r.column_name === name);
    if (!exists) console.error("!!! MISSING:", name);
    else console.log("OK:", name);
  }
  await c.end();
})();
' 2>&1 | grep -v "Warning\|SECURITY\|getaddrinfo\|SSL modes\|libpq"
```

Expected: Total: 56 (53 + 3 new). New columns listed. All `OK:` lines present.

**Step 9.5 — Manual smoke test:** push to staging, hit `/business/<slug-of-flagged-business>` to see the badge render. Hit `dashboard/edit` and toggle the checkbox, confirm save. Hit `/admin/businesses`, edit a business, toggle, confirm save.

**Step 9.6 — Final commit (if any deferred cleanups):**

```bash
git status
git add ...
git commit -m "chore: cleanup"
```

---

## Tests / Validation Summary

| Layer | Test | Pass criteria |
|---|---|---|
| Schema | Live DB column probe | 3 new columns present, 0 existing dropped |
| TypeScript | `npx tsc --noEmit` | 0 errors |
| Build | `npm run build` | 0 errors |
| Unit | `npx vitest run` | All tests pass; new test cases for the 3 fields |
| Type discipline | `grep -rn "from @prisma\|from pg\|from fs"` in `chamber-display.ts` | 0 matches |
| Public render | Hit `/business/<slug>` for a Chamber-flagged business | Badge visible |
| Owner edit | Toggle checkbox in dashboard, save | Persists across reload |
| Admin edit | Toggle checkbox in moderation panel, save | Persists across reload |

---

## Risks, Tradeoffs, and Open Questions

### Q1 — Should the claim form (`/claim`) also collect these fields?

The `/claim` flow currently only creates the owner's account. The first time the owner sees the form is at `/dashboard/edit`. Two paths:

- **Option A (default):** Don't add checkboxes to `/claim`. Owners see them on `/dashboard/edit` after claim. Pro: one less thing during the magic-link flow. Con: owners might not realize the option exists until later.
- **Option B:** Add three checkboxes to `/claim` (the form between "create account" and "claim complete"). Pro: 80% completion vs. 30% from edit. Con: more friction on the magic-link flow.

**Default: Option A.** Reasons: (1) the claim flow is a high-stakes moment (magic-link, password creation) — adding three more checkboxes dilutes the conversion funnel; (2) the badges work whether set during claim or later; (3) the dashboard edit page is the canonical "configure your listing" surface. Johnny can ask for Option B if he wants it.

### Q2 — Slug list for the seed/backfill script

The placeholder script (Task 8) needs the actual list of Chamber + Hispanic Chamber members + Spanish-speaking businesses. Johnny has a spreadsheet of Chamber members and the Hispanic Chamber directory. Defer to a follow-up task once the lists are confirmed.

### Q3 — Search/filter integration (out of scope)

The badges are purely display-only. Future work: filter `/api/search` by `chamberMember: true`, surface a "Chamber Members" Best-Of-like section, add a "Se Habla Español" filter chip. **Not in this scope.**

### Q4 — Badge ordering on the card

`BusinessCard.tsx` has a single badge row that currently shows Best-Of + Expert Partner. The new row is a separate row below it. If Johnny wants all badges in one row, can be rearranged in 5 minutes. Default: separate row, same as the Expert Partner + Best-Of logic.

### Q5 — Should the badge be on the homepage priority function?

Tier sort order (per `tier-and-bestof-architecture-2026-08-09.md`) is purely tier-based. The chamber badges do NOT affect sort order. **Default: no impact.** If Johnny wants "Chamber members sort above non-members in the same tier," that's a follow-up.

### Q6 — Migration approach

The plan uses a hand-written migration (not `prisma migrate dev` autogenerated) because the live DB has drift from prior agent commits. Per the `destructive-prisma-push` skill, this is the documented exception. The hand-written migration is additive-only — three `ADD COLUMN` statements with default values. **No data loss possible.** If anything else looks wrong in the diff (drop / alter / etc.), STOP and re-investigate.

### Q7 — Multi-agent collision

This project is operated by multiple Hermes agents. The destructive-prisma-push skill flags this. Mitigation: every commit is self-contained (no in-flight changes touching unrelated files), and the schema verification step (Task 1.2) is mandatory before any DB action.

---

## Out of Scope

- Search/filter UI for Chamber members
- "Chamber Members" Best-Of-like section
- "Se Habla Español" filter chip on `/search`
- Chamber badge on the homepage priority function
- Spanish-language version of the listing or site
- Auto-confirmation against Chamber directories (would require integration with the Chamber's own API)
- Chamber membership expiry tracking
- Per-business "Chamber since" date field (could be added later if Johnny wants it)
