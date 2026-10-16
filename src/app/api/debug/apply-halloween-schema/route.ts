import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/**
 * TEMPORARY: apply the Halloween migrations to the Hyperdrive-connected DB.
 * The Hyperdrive DB is missing the HalloweenEntry / HalloweenVote tables that
 * exist in the local Neon DB in .env.local. This route runs the two migrations
 * (CREATE TABLE IF NOT EXISTS + ALTER COLUMN DROP NOT NULL) idempotently.
 *
 * DELETE this route after the form is working.
 *
 * Auth: requires ?secret=<CRON_SECRET> or Authorization: Bearer <CRON_SECRET>.
 * (Reusing CRON_SECRET because it's the only secret we have on-hand; the route
 * is one-shot and will be removed immediately after.)
 */

// Inlined from scripts/sql/2026-10-halloween-contest.sql
// and scripts/sql/2026-10-halloween-anonymous.sql. Both files are idempotent.
const HALLOWEEN_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "HalloweenEntry" (
  "id"              text PRIMARY KEY NOT NULL,
  "displayName"     text NOT NULL,
  "tagline"         text,
  "description"     text,
  "category"        text,
  "contactName"     text NOT NULL,
  "contactEmail"    text NOT NULL,
  "contactPhone"    text,
  "streetAddress"   text NOT NULL,
  "city"            text NOT NULL DEFAULT 'Moreno Valley',
  "zip"             text,
  "addressKey"      text NOT NULL,
  "latitude"        double precision,
  "longitude"       double precision,
  "showExactAddress" boolean NOT NULL DEFAULT false,
  "publicLatitude"  double precision,
  "publicLongitude" double precision,
  "locationLabel"   text,
  "photoUrls"       text[] NOT NULL DEFAULT ARRAY[]::text[],
  "status"          "Status" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" text,
  "ipHash"          text,
  "createdAt"       timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt"      timestamp(3),
  "updatedAt"       timestamp(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "HalloweenEntry_addressKey_key" ON "HalloweenEntry" ("addressKey");
CREATE INDEX IF NOT EXISTS "HalloweenEntry_status_idx" ON "HalloweenEntry" ("status");
CREATE INDEX IF NOT EXISTS "HalloweenEntry_ipHash_createdAt_idx" ON "HalloweenEntry" ("ipHash", "createdAt" DESC);

CREATE TABLE IF NOT EXISTS "HalloweenVote" (
  "id"        text PRIMARY KEY NOT NULL,
  "entryId"   text NOT NULL,
  "ipHash"    text NOT NULL,
  "deviceId"  text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HalloweenVote_entryId_fkey" FOREIGN KEY ("entryId")
    REFERENCES "HalloweenEntry"("id") ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "HalloweenVote_entryId_idx" ON "HalloweenVote" ("entryId");
CREATE UNIQUE INDEX IF NOT EXISTS "HalloweenVote_entryId_ipHash_key" ON "HalloweenVote" ("entryId", "ipHash");
CREATE UNIQUE INDEX IF NOT EXISTS "HalloweenVote_entryId_deviceId_key" ON "HalloweenVote" ("entryId", "deviceId");
`

const HALLOWEEN_ANONYMOUS_SQL = `
ALTER TABLE "HalloweenEntry" ALTER COLUMN "contactName"  DROP NOT NULL;
ALTER TABLE "HalloweenEntry" ALTER COLUMN "contactEmail" DROP NOT NULL;
ALTER TABLE "HalloweenEntry" ALTER COLUMN "displayName"  DROP NOT NULL;
ALTER TABLE "HalloweenEntry" ALTER COLUMN "description"  DROP NOT NULL;
`

function authorize(req: NextRequest): { ok: true } | { ok: false; why: string } {
  const expected = process.env.CRON_SECRET
  if (!expected) return { ok: false, why: 'CRON_SECRET not configured in Worker' }
  const url = new URL(req.url)
  const fromQuery = url.searchParams.get('secret')
  const fromHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const given = fromQuery || fromHeader
  if (!given) return { ok: false, why: 'missing ?secret=... or Authorization header' }
  if (given !== expected) return { ok: false, why: 'secret mismatch' }
  return { ok: true }
}

export async function POST(req: NextRequest) {
  const auth = authorize(req)
  if (!auth.ok) return NextResponse.json({ error: auth.why }, { status: 401 })

  const out: Record<string, unknown> = { ok: true }

  try {
    await db.execute(sql.raw(HALLOWEEN_SCHEMA_SQL))
    out.schema_applied = true
  } catch (err) {
    out.schema_applied_err = {
      message: err instanceof Error ? err.message : String(err),
      chain: serializeChain(err),
    }
    out.ok = false
  }

  try {
    await db.execute(sql.raw(HALLOWEEN_ANONYMOUS_SQL))
    out.anonymous_applied = true
  } catch (err) {
    out.anonymous_applied_err = {
      message: err instanceof Error ? err.message : String(err),
      chain: serializeChain(err),
    }
    out.ok = false
  }

  // Verify by re-running the diagnostic queries
  try {
    const v = await db.execute(sql`SELECT to_regclass('public."HalloweenEntry"') AS r`)
    out.table_exists_now = v.rows[0]?.r
  } catch (err) {
    out.verify_err = serializeChain(err)
  }

  return NextResponse.json(out, { status: out.ok === false ? 500 : 200 })
}

function serializeChain(err: unknown): unknown[] {
  const chain: { name?: string; message: string; code?: string }[] = []
  let cur: unknown = err
  let depth = 0
  while (cur && depth < 5) {
    const e = cur as { name?: string; message?: string; code?: unknown; cause?: unknown }
    chain.push({
      name: e.name,
      message: e.message ?? '(no message)',
      code: typeof e.code === 'string' ? e.code : undefined,
    })
    cur = e.cause
    depth += 1
  }
  return chain
}