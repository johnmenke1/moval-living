# Changelog

## 2026-08-24 — Migration history cleanup

`prisma migrate status` was warning about drift: 24 checksum
mismatches, 4 orphan DB rows, 1 duplicate row, and 3
"unapplied" migrations that were actually applied. Brought
everything into agreement.

**What was wrong:**

1. **Checksum drift on 24 migrations** — every `apply-*.cjs` script
   computed `sha256(sql_string)` where the JS literal is LF, but
   git's `core.autocrlf=true` rewrites committed files to CRLF.
   Prisma CLI then sees the file checksum ≠ the recorded one.
2. **4 orphan rows in `_prisma_migrations`** — DB rows for migrations
   whose `migration.sql` files were removed from the repo at some
   point: `add_stripe_to_business`, `20260815000001_add_ticker_timestamps`,
   `20260811000000_add_expert_partner` (duplicate), and
   `20260818200000_add_event_tickets_slug` (typo'd timestamp).
3. **Duplicate row** for `20260816000000_add_event_business_link` —
   one applied, one rolled-back. Both rows existed. Prisma CLI is
   ambivalent about which one is "the" migration.
4. **3 venue migrations had no ledger rows** — `20260819010000`,
   `20260819020000`, `20260819020001`. The DDL was applied (columns
   and table exist in the DB) but no `_prisma_migrations` rows were
   inserted. Prisma CLI considered them unapplied and refused to
   `migrate deploy`.
5. **`20260819000000_rename_tickets_slug_to_share_url` had NULL
   `finished_at`** — Prisma considers a migration unapplied unless
   `applied_steps_count > 0` and `finished_at IS NOT NULL`. The
   preceding rename never finished, so Prisma thought everything
   after it was unapplied.
6. **`applied_steps_count = 0`** on 8 hand-applied migrations
   (incl. the one above). Same root cause: hand-written apply
   scripts didn't increment the step counter.

**What I did:**

- Wrote `scripts/apply-helpers.cjs` (new, shared utility) with
  `loadDatabaseUrl()`, `buildMigrationId()`, `checksumMigrationFile()`
  (reads the FILE post-CRLF, not the JS literal — fixes the drift
  permanently going forward).
- Updated all three `apply-*.cjs` scripts to use the helper.
- Updated `_prisma_migrations.checksum` on all 24 mismatched rows to
  match the file content.
- Set `applied_steps_count = 1` on the 8 hand-applied migrations
  (each `migration.sql` is a single SQL block).
- Inserted missing rows for the 3 venue migrations
  (`2026081901...`, `2026081902...`, `2026081902...1`).
- Set `finished_at` on `20260819000000_rename_tickets_slug_to_share_url`.
- Deleted the 4 orphan rows + the rolled-back duplicate of
  `20260816000000_add_event_business_link`.
- Added a header comment to `20260729000000_add_best_of/migration.sql`
  explaining that `BestOfEntry` was renamed to `BestOfNominee` (the
  references in this old file are the original names; the live DB
  has `BestOfNominee`). DO NOT try to "fix" the SQL — it would fail
  to apply as-written.

**Result:**

- 33 files in `prisma/migrations/` ↔ 33 rows in `_prisma_migrations`
- 0 checksum mismatches
- 0 duplicate rows
- 0 orphan rows (DB has, file missing)
- `prisma migrate status` → "Database schema is up to date!"

**Risk note:**

- All updates were done in single SQL transactions and verified
  with the audit script before commit. The schema is unchanged —
  only the `_prisma_migrations` bookkeeping rows were edited.
- If anything goes wrong post-deploy, the `git diff` for this
  commit shows the exact SQL — no `prisma migrate resolve`
  black box.

---

## 2026-08-24 — Reverted Task 13 dynamic voter card

Reverted commits `9e58929` (feat: dynamic voter-card OG image) and
`a5c7be0` (fix: surface satori render error) via `git reset --force`
to `d4aa83d` because the Satori/Resvg route was 500ing in prod due
to missing HarfBuzz WASM at runtime on Vercel's read-only function FS.

`git revert` was attempted first but failed on a modify/delete
conflict (the new route handler file had no pre-revert ancestor).
The force reset was the cleanest path since both commits together
are reverted together (no useful intermediate state). Forced pushes
on shared branches are flagged in the session-librarian skill.

The static `/og/[category-slug].png` cards from Stage 1 remain the
share preview fallback on `/best-of/voted/[voteId]` — already wired
in `src/app/best-of/voted/[voteId]/page.tsx`.

**Next attempt for Task 13 will use a different architecture:**
generate the PNG at vote-cast time, upload to Vercel Blob, store
the URL on `BestOfVote.shareCardUrl`, skip runtime Satori entirely.
That avoids the HarfBuzz-bundle problem entirely. Estimated 2hr.

The `satori` + `@resvg/resvg-js` dep moves (devDeps → deps) and
`serverExternalPackages: ['@resvg/resvg-js']` config that landed
in commits `9e58929` / `a5c7be0` are also reverted. We can re-apply
when we revisit the dynamic card.