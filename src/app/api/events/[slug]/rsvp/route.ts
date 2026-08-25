import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { EventAttendeeStatus } from '@prisma/client'

interface RouteParams {
  params: Promise<{ slug: string }>
}

const VALID_STATUSES: EventAttendeeStatus[] = ['GOING', 'INTERESTED']

/**
 * POST /api/events/[slug]/rsvp
 *
 * Sets the current user's RSVP status for the event. If a row already
 * exists, updates it. Requires authentication.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Sign in to RSVP to this event' },
      { status: 401 },
    )
  }

  const { slug } = await params
  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, archivedAt: true },
  })
  if (!event || event.archivedAt) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const status = (body as { status?: unknown })?.status
  if (!VALID_STATUSES.includes(status as EventAttendeeStatus)) {
    return NextResponse.json(
      { error: 'Status must be GOING or INTERESTED' },
      { status: 400 },
    )
  }

  const upserted = await prisma.eventAttendee.upsert({
    where: {
      eventId_ownerId: {
        eventId: event.id,
        ownerId: session.user.id,
      },
    },
    update: {
      status: status as EventAttendeeStatus,
      updatedAt: new Date(),
    },
    create: {
      eventId: event.id,
      ownerId: session.user.id,
      status: status as EventAttendeeStatus,
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ attendee: upserted })
}

/**
 * DELETE /api/events/[slug]/rsvp
 *
 * Removes the current user's RSVP for the event. Idempotent — succeeds
 * even if no row exists.
 */
export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Sign in to update your RSVP' },
      { status: 401 },
    )
  }

  const { slug } = await params
  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true },
  })
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  await prisma.eventAttendee.deleteMany({
    where: {
      eventId: event.id,
      ownerId: session.user.id,
    },
  })

  return NextResponse.json({ removed: true })
}
