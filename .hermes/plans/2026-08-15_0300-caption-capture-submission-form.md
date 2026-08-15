# Caption Capture — Implementation Spec

**Author:** Molly (M3, Hermes)
**Date:** 2026-08-15
**Status:** Approved by Johnny, in flight
**Branch:** design-refresh

---

## What we're building

Make caption text from the original post flow into our Submission → Event pipeline, so the public `/events` page can render real editorial descriptions instead of cards with empty description fields.

**Two paths:**

| | Caption source | When | Storage |
|---|---|---|---|
| Path A | Submitter-typed (required, on the form) | v1, ships today | `Submission.submitterNote` (existing column, repurposed) |
| Path B | Microlink auto-extract (third-party service) | Later, after v1 lands | `Submission.submitterNote` (same column) |

Path A is what we're shipping. Path B is intentionally deferred because:

- It depends on a third-party service (microlink.io) account signup and API key, which requires Johnny's action.
- The current IG oEmbed endpoint doesn't expose caption text — that's why capture is broken today. Microlink is one of the few services that reliably extracts IG description.
- Path A gets us caption data flowing through with zero new dependencies. Path B makes the form even smoother later.

When Path B lands, it becomes the "if submitter didn't paste a caption, attempt automated extraction" fallback. The form stays the same. The API gains a Microlink call before persisting.

---

## Schema migration

`prisma/migrations/<ts>_make_caption_required/`

```sql
-- Existing column repurposed. No destructive rename.
-- Note: keeping the column name `submitterNote` is intentional —
-- reuses existing rows, no data loss. The semantic intent shifts.

-- Add NOT NULL constraint to require caption content going forward.
-- Pre-existing nulls get a sensible fallback so the migration
-- doesn't fail on the 3 today's submissions + 5 migration rows.

ALTER TABLE "Submission"
  ALTER COLUMN "submitterNote" SET NOT NULL,
  ALTER COLUMN "submitterNote" SET DEFAULT '';
```

For the 8 existing rows where `submitterNote IS NULL`:
- **Today's 3 submissions** (`08-15-26-a/b/c`): Johnny backfills the IG caption as part of his first review pass. Captions land in the database via the admin API edit path.
- **5 migration rows** (`07-26-26-a` through `08-10-26-a`): the migration script can be re-run if those events are still relevant; otherwise we leave them with empty captions and they live as "events with no description" until Johnny (or Emma) decides otherwise.

If we wanted to handle the existing NULLs in the migration itself, we'd need to read submission metadata or fall back to the title. I'd default to title-fallback for the migration: `UPDATE "Submission" SET "submitterNote" = title WHERE "submitterNote" IS NULL;` — better than `''` because at least *something* reads on the card. Johnny can edit the actual caption in admin review later. This keeps the migration non-destructive and immediately consumable.

---

## Form change

`src/app/submit/event/page.tsx` — relabel + make required.

Old (current):
```tsx
<label htmlFor="submitterNote">Anything else? (optional)</label>
<textarea name="submitterNote" placeholder="Context that doesn't fit anywhere" />
```

New:
```tsx
<label htmlFor="caption">
  Paste the original post caption
  <span className="required-mark">*</span>
</label>
<p className="field-hint">
  The original text from the social post (or flyer copy). We'll display
  it on the public event page so visitors know what the event is about.
  Reproduce it verbatim — extra formatting, hashtags, and all.
</p>
<textarea
  name="caption"
  required
  minLength={1}
  placeholder="e.g. 🎉 Big Saturday Event — food, music, fun for all ages. 4pm at the gazebo."
/>
```

Submit button stays enabled only when caption field is filled. Form rejects empty submission client-side; server-side validation (zod) is the source of truth — `caption: z.string().min(1)`.

---

## API change

`src/app/api/submissions/route.ts`

```ts
const schema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  startsAt: z.string(),
  endsAt: z.string().optional(),
  venueName: z.string().optional(),
  caption: z.string().min(1), // NEW: required
})

// In the prisma.submission.create call:
data: {
  // ... existing fields ...
  submitterNote: parsed.data.caption, // Stored in existing column
}
```

The API field is `caption` for clarity. The DB column stays `submitterNote` so the migration is non-destructive. This is a low-risk repurpose: the column was used for exactly this intent already; the form is just making it explicit.

---

## Admin panel

`src/components/admin/EventSubmissionsPanel.tsx` — already shows `submitterNote` content. No UI change needed for v1. The expanded card view already renders the field. Eventually we may want to:

- Relabel "Submitter note" to "Caption" in the admin UI for consistency.
- Add a one-click "Edit caption" affordance if the curator wants to polish the wording before approving.

Both deferred to v2.

---

## Approval flow

**No change.** The existing approval route (`src/app/api/admin/submissions/[id]/route.ts`) already copies `submission.submitterNote` into both `description` and `sourcePostExcerpt` on the resulting Event. Now that the field is required and meaningful, this copy-through gives the public `/events` card its real editorial text.

If a curator wants to override the description at approval time, they can edit the Event in the dashboard's Events tab after approval. That's today's flow.

---

## What the curator sees after approval

For an Event created from a Submission with caption text:

```
┌─────────────────────────────────────────────────┐
│ [FAL-generated hero image, 16:9]               │
│                                                 │
│ Halloween Village                               │
│ Sat, Oct 3 · 6:00 PM                            │
│ 11800 Indiana Ave, Riverside                    │
│                                                 │
│ 🎃 Event details from the IG caption:          │
│ "🎃 Spooky family fun for all ages! Outdoor    │
│ market with costumes, treats, games, and a     │
│ haunted hayride. Food vendors on site.          │
│ Costumes encouraged, scary costumes discouraged.│
│ Free admission."                                │
│                                                 │
│ [via Instagram ↗]                               │
└─────────────────────────────────────────────────┘
```

Caption block has its own visual treatment: serif type, indented, quote-style. Reads as "this is the description from the original post" rather than admin-generated copy.

---

## Deployment order

1. **Migration:** Add the schema change via Prisma migrate. Apply locally first, test, then `prisma migrate deploy` against Neon.
2. **Form update:** Add `caption` field, mark required. Local dev test.
3. **API update:** Add `caption` zod validator. Local dev test.
4. **Commit** as `feat(submissions): make caption required for submission form`. Co-authored-by: emma <john@menke.re>.
5. **Vercel deploy** via standard push-to-origin flow.
6. **Backfill existing rows:** Run a script that updates existing NULL captions with title-fallback. Mark as `chore(submissions): backfill empty captions with title fallback`.
7. **Visual verification:** Submit a test event through `/submit/event` with a real caption, verify it shows up in the dashboard with the caption visible, approve it, verify it shows up on `/events` with the description populated.

---

## Open questions

1. **Should we offer a fallback option?** If a submitter really doesn't want to paste the caption, can they submit without one? My answer is no for v1 — captions are part of the editorial product. If volume becomes a problem we revisit.
2. **Should the admin re-write field show on the Event edit page?** Not in v1 — events can be edited, but caption text is not specifically called out. v2.
3. **What happens to the Field-Hint copy?** Right now it's `Reproduce it verbatim — extra formatting, hashtags, and all.` Is that the right framing? Reads as permission to be casual, but maybe too permissive? We can iterate if needed.

---

## Risks

- **Friction increase.** Required fields reduce submission rate. We're trading off submission volume for editorial quality. Worth it for our scale.
- **Caption length.** If someone pastes a 5000-character IG caption (rare but possible), we should truncate display, not truncation at the API. The form's `maxLength` attribute keeps server load reasonable.
- **Profanity / moderation.** Captions could include profanity or off-brand language. Curator reviews before publish, so this surfaces in the admin queue, not on the public page. The pipeline is "always human-checked before publication."

---

## What's NOT in scope

- Microlink integration (Path B). Defer until v1 ships and we have signal on whether manual pasting is sustainable.
- Auto-trimming captions (newlines, hashtags, etc.). Captions render as-typed for v1. Curator edits if they want a polish.
- Captions on community-imported events (e.g. Photo/Outdoor description on Life posts). Those have their own description paths; we'd wire this differently later if needed.
