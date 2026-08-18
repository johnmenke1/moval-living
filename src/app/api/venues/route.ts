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
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const take = 10

  // If empty query, return all venues alphabetically (small set).
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { slug: { contains: q, mode: 'insensitive' as const } },
          { city: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const venues = await prisma.venue.findMany({
    where,
    select: {
      id: true,
      slug: true,
      name: true,
      org: true,
      address: true,
      city: true,
      state: true,
      zip: true,
    },
    orderBy: { name: 'asc' },
    take,
  })

  return NextResponse.json({ venues })
}
