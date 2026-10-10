/**
 * GET /api/venues?q=...
 *
 * Public autocomplete endpoint for the event submission form. Returns
 * matching venues ordered by name with their address fields so the
 * client can auto-populate address / city / state / zip on the form
 * when a user picks one. Case-insensitive prefix match on name (and
 * slug for power users), capped at 10 results.
 *
 * No auth required — the submission form is public.
 */

import { NextRequest, NextResponse } from 'next/server'
import { asc, ilike, or } from 'drizzle-orm'
import { db, venue, escapeLike } from '@/db'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const take = 10

  // If empty query, return all venues alphabetically (small set).
  const pattern = `%${escapeLike(q)}%`
  const venues = await db.query.venue.findMany({
    where: q
      ? or(ilike(venue.name, pattern), ilike(venue.slug, pattern), ilike(venue.city, pattern))
      : undefined,
    columns: {
      id: true,
      slug: true,
      name: true,
      org: true,
      address: true,
      city: true,
      state: true,
      zip: true,
    },
    orderBy: asc(venue.name),
    limit: take,
  })

  return NextResponse.json({ venues })
}
