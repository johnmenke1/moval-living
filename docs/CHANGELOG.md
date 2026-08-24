# Changelog

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
