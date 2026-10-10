# Legacy Prisma scripts — read me

As of the **Oct 9, 2026** Drizzle migration (`drizzle-migration` branch → master),
the active codebase no longer uses `@prisma/client`. Files below still import
the old client and **will fail** to run until rewritten against `drizzle-orm`.

These scripts are kept on disk for two reasons:

1. They contain real data-fix logic (dedupe, backfill, park seeding) that we may
   want to re-run against future Drizzle-era datasets — and rewriting them
   burns context we don't have right now.
2. Nobody confirmed who authored each one — touching them risks destroying
   work-in-progress of another session.

## What's here

- `scripts/*.cjs` (most files), `scripts/*.mts`, `scripts/*.mjs` — about 25 of
  them import `@prisma/client`. They worked when the codebase was on Prisma.
- `prisma/seed.ts` — schema-era backfill seed.
- `prisma/schema.prisma` + `prisma/migrations/` — the historical Prisma schema
  and its migration SQL; kept for archaeology + as a reference for anyone who
  needs to understand the "what was this column for?" back-fill.
- `scratch/*.mjs` — one-off date-named diagnostic helpers (e.g. pending-events
  queries from cron outages). Not intended to be run again.

## If you need to re-run one of these

Don't. Instead, port the script's logic to a new file under
`scripts/drizzle-compat/...` that imports from `src/db` (`db`, the table
helpers, `eq`). One PR per script. Most are 20-line conversions once you see
the Prisma → Drizzle query shape.

## What to delete from this list

None, in this commit. Cleanup is queued for a follow-up.

— last reviewed 2026-10-09
