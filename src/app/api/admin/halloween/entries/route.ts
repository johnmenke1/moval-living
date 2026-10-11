import { NextResponse } from 'next/server'
import { desc, sql } from 'drizzle-orm'
import { auth } from '@/auth'
import { db, halloweenEntry } from '@/db'

export const dynamic = 'force-dynamic'

// GET /api/admin/halloween/entries - every entry incl. private contact + exact address.
export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const rows = await db
    .select({
      entry: halloweenEntry,
      votes: sql<number>`(select count(*)::int from "HalloweenVote" v where v."entryId" = "HalloweenEntry"."id")`,
    })
    .from(halloweenEntry)
    .orderBy(desc(halloweenEntry.createdAt))
  return NextResponse.json({
    entries: rows.map((r) => ({ ...r.entry, ipHash: undefined, votes: r.votes })),
  })
}
