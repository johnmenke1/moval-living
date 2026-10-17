import { NextRequest, NextResponse } from 'next/server'
import { desc, sql } from 'drizzle-orm'
import { db, halloweenEntry } from '@/db'

export const dynamic = 'force-dynamic'

/**
 * TEMPORARY: lists every entry currently in HalloweenEntry with a count of
 * how many came from the same ipHash (the rate-limit key). DELETE after
 * Johnny decides which test entries to delete.
 *
 * Auth: ?secret=<CRON_SECRET> or Authorization: Bearer <CRON_SECRET>.
 */
function authorize(req: NextRequest): { ok: true } | { ok: false; why: string } {
  const expected = process.env.CRON_SECRET
  if (!expected) return { ok: false, why: 'CRON_SECRET not configured' }
  const url = new URL(req.url)
  const fromQuery = url.searchParams.get('secret')
  const fromHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const given = fromQuery || fromHeader
  if (!given) return { ok: false, why: 'missing ?secret= or Authorization' }
  if (given !== expected) return { ok: false, why: 'secret mismatch' }
  return { ok: true }
}

export async function GET(req: NextRequest) {
  const auth = authorize(req)
  if (!auth.ok) return NextResponse.json({ error: auth.why }, { status: 401 })

  const rows = await db
    .select({
      id: halloweenEntry.id,
      displayName: halloweenEntry.displayName,
      streetAddress: halloweenEntry.streetAddress,
      zip: halloweenEntry.zip,
      latitude: halloweenEntry.latitude,
      longitude: halloweenEntry.longitude,
      status: halloweenEntry.status,
      ipHash: halloweenEntry.ipHash,
      createdAt: halloweenEntry.createdAt,
    })
    .from(halloweenEntry)
    .orderBy(desc(halloweenEntry.createdAt))

  // Group by ipHash so Johnny can see what counts as "from this network"
  const byIp = new Map<string, { n: number; ids: string[]; latest: Date | null }>()
  for (const r of rows) {
    if (!r.ipHash) continue
    const cur = byIp.get(r.ipHash) ?? { n: 0, ids: [], latest: null as Date | null }
    cur.n += 1
    cur.ids.push(r.id)
    if (!cur.latest || r.createdAt > cur.latest) cur.latest = r.createdAt
    byIp.set(r.ipHash, cur)
  }

  return NextResponse.json({
    total: rows.length,
    entries: rows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      streetAddress: r.streetAddress,
      zip: r.zip,
      latitude: r.latitude,
      longitude: r.longitude,
      status: r.status,
      ipHashPrefix: r.ipHash ? r.ipHash.slice(0, 12) + '...' : null,
      createdAt: r.createdAt,
    })),
    rate_limit_groups: Array.from(byIp.entries())
      .map(([ip, v]) => ({ ipPrefix: ip.slice(0, 12) + '...', n: v.n, ids: v.ids, latest: v.latest }))
      .sort((a, b) => b.n - a.n),
  })
}

export async function DELETE(req: NextRequest) {
  // Delete one entry by id. Use ?id=<id> or { "id": "..." } body.
  // Auth: same as GET.
  const auth = authorize(req)
  if (!auth.ok) return NextResponse.json({ error: auth.why }, { status: 401 })

  let id: string | null = null
  const url = new URL(req.url)
  if (url.searchParams.get('id')) id = url.searchParams.get('id')
  if (!id) {
    const body = (await req.json().catch(() => null)) as { id?: string } | null
    id = body?.id ?? null
  }
  if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 })

  const deleted = await db
    .delete(halloweenEntry)
    .where(sql`"id" = ${id}`)
    .returning({ id: halloweenEntry.id })
  return NextResponse.json({ deleted: deleted.length, id })
}
