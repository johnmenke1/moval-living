import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

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

  const rows = await prisma.eventAttendee.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      status: true,
      createdAt: true,
      event: {
        select: {
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
