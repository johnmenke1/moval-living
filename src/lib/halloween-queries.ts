import { desc, eq, or, sql } from 'drizzle-orm'
import { db, halloweenEntry, halloweenVote } from '@/db'

/** The only shape the public ever sees - no contact info, no exact address unless opted in. */
export interface PublicHalloweenEntry {
  id: string
  displayName: string
  tagline: string | null
  description: string | null
  category: string | null
  photoUrls: string[]
  latitude: number | null
  longitude: number | null
  locationLabel: string | null
  exactAddress: boolean
  votes: number
  createdAt: string
}

export async function getPublicEntries(): Promise<PublicHalloweenEntry[]> {
  const rows = await db
    .select({
      id: halloweenEntry.id,
      displayName: halloweenEntry.displayName,
      tagline: halloweenEntry.tagline,
      description: halloweenEntry.description,
      category: halloweenEntry.category,
      photoUrls: halloweenEntry.photoUrls,
      latitude: halloweenEntry.publicLatitude,
      longitude: halloweenEntry.publicLongitude,
      locationLabel: halloweenEntry.locationLabel,
      exactAddress: halloweenEntry.showExactAddress,
      createdAt: halloweenEntry.createdAt,
      votes: sql<number>`(select count(*)::int from "HalloweenVote" v where v."entryId" = ${halloweenEntry.id})`,
    })
    .from(halloweenEntry)
    .where(eq(halloweenEntry.status, 'APPROVED'))
    .orderBy(desc(halloweenEntry.createdAt))

  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
}

/** Entry ids this device / network has already voted for. */
export async function getVotedEntryIds(deviceId: string | null, ipHash: string | null): Promise<string[]> {
  const conds = []
  if (deviceId) conds.push(eq(halloweenVote.deviceId, deviceId))
  if (ipHash) conds.push(eq(halloweenVote.ipHash, ipHash))
  if (conds.length === 0) return []
  const rows = await db
    .select({ entryId: halloweenVote.entryId })
    .from(halloweenVote)
    .where(or(...conds))
  return Array.from(new Set(rows.map((r) => r.entryId)))
}

export async function countVotes(entryId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(halloweenVote)
    .where(eq(halloweenVote.entryId, entryId))
  return row?.n ?? 0
}

