import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { desc, eq } from 'drizzle-orm'
import { db, eventAttendee } from '@/db'

/**
 * GET /api/profile/events
 *
 * Returns events the current Owner has RSVPed to, split by status:
 *   GOING and INTERESTED. Newest RSVP first.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Sign in to view your events' },
      { status: 401 },
    )
  }

  const rows = await db.query.eventAttendee.findMany({
    where: eq(eventAttendee.ownerId, session.user.id),
    orderBy: desc(eventAttendee.createdAt),
    columns: {
      id: true,
      status: true,
      createdAt: true,
    },
    with: {
      event: {
        columns: {
          id: true,
          slug: true,
          title: true,
          startsAt: true,
          venueName: true,
          city: true,
          heroImageUrl: true,
        },
      },
    },
  })

  const attending = rows
    .filter((r) => r.status === 'GOING')
    .map((r) => ({
      id: r.event.id,
      attendeeId: r.id,
      slug: r.event.slug,
      title: r.event.title,
      startsAt: r.event.startsAt.toISOString(),
      venueName: r.event.venueName,
      city: r.event.city,
      heroImageUrl: r.event.heroImageUrl,
    }))

  const interested = rows
    .filter((r) => r.status === 'INTERESTED')
    .map((r) => ({
      id: r.event.id,
      attendeeId: r.id,
      slug: r.event.slug,
      title: r.event.title,
      startsAt: r.event.startsAt.toISOString(),
      venueName: r.event.venueName,
      city: r.event.city,
      heroImageUrl: r.event.heroImageUrl,
    }))

  return NextResponse.json({ attending, interested })
}
