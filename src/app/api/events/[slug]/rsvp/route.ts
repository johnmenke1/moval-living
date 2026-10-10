import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { and, eq } from 'drizzle-orm'
import { db, event as eventTable, eventAttendee } from '@/db'

type EventAttendeeStatus = (typeof eventAttendee.$inferSelect)['status']

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
  const event = await db.query.event.findFirst({
    where: eq(eventTable.slug, slug),
    columns: { id: true, archivedAt: true },
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

  const [upserted] = await db
    .insert(eventAttendee)
    .values({
      eventId: event.id,
      ownerId: session.user.id,
      status: status as EventAttendeeStatus,
    })
    .onConflictDoUpdate({
      target: [eventAttendee.eventId, eventAttendee.ownerId],
      set: { status: status as EventAttendeeStatus, updatedAt: new Date() },
    })
    .returning({
      id: eventAttendee.id,
      status: eventAttendee.status,
      createdAt: eventAttendee.createdAt,
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
  const event = await db.query.event.findFirst({
    where: eq(eventTable.slug, slug),
    columns: { id: true },
  })
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  await db
    .delete(eventAttendee)
    .where(and(eq(eventAttendee.eventId, event.id), eq(eventAttendee.ownerId, session.user.id)))

  return NextResponse.json({ removed: true })
}
