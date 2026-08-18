import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'duplicate']),
  eventId: z.string().optional(), // required when action === 'duplicate'
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Admin auth check
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: submissionId } = await params

  // Parse + validate body
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const submission = await prisma.submission.findUnique({ where: { id: submissionId } })
  if (!submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }
  if (submission.status !== 'PENDING') {
    return NextResponse.json(
      { error: `Submission is already ${submission.status}` },
      { status: 409 }
    )
  }

  const reviewedById = session.user.id
  const reviewedAt = new Date()

  switch (parsed.data.action) {
    case 'approve': {
      // Create a new Event from the Submission. We carry over everything
      // the submitter gave us; admin can edit the Event from the dashboard
      // afterwards (venue address, hero image, category, tier, etc.).
      const eventSlug = generateEventSlug(submission.title)

      const event = await prisma.event.create({
        data: {
          slug: eventSlug,
          title: submission.title,
          description: submission.sourcePostCaption ?? submission.submitterNote ?? null,
          startsAt: submission.startsAt,
          endsAt: submission.endsAt ?? null,
          venueName: submission.venueName ?? null,
          venueId: submission.venueId ?? null,
          venueTag: 'OTHER', // admin can re-tag from the dashboard
          tier: 'STANDARD',
          // Carry the address fields forward. When submission has a linked
          // Venue (venueId set), these were populated from the Venue at
          // submission time. When venueId is null but address/city/etc are
          // set, the submitter typed them manually — admin can edit.
          address: submission.address ?? null,
          city: submission.city ?? null,
          state: submission.state ?? null,
          zip: submission.zip ?? null,
          // Carry the fal-generated hero image forward so the Event renders
          // immediately on /events. Admin can replace via dashboard.
          heroImageUrl: submission.thumbnailUrl ?? null,
          source: submission.sourcePlatform,
          sourceUrl: submission.sourceUrl,
          sourceAuthorHandle: submission.sourceAuthorHandle ?? null,
          sourceAuthorUrl: submission.sourceAuthorUrl ?? null,
          // Capture the original IG caption as sourcePostExcerpt for
          // editorial context. Admin sees this when reviewing tier decisions.
          sourcePostExcerpt: submission.sourcePostCaption ?? submission.submitterNote ?? null,
          originatingSubmissionId: submission.id,
          submittedById: submission.submittedById ?? null,
          reviewedById,
          reviewedAt,
        },
      })

      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: 'APPROVED',
          reviewedById,
          reviewedAt,
          promotedToEventId: event.id,
        },
      })

      return NextResponse.json({ event })
    }

    case 'reject': {
      await prisma.submission.update({
        where: { id: submission.id },
        data: { status: 'REJECTED', reviewedById, reviewedAt },
      })
      return NextResponse.json({ success: true })
    }

    case 'duplicate': {
      if (!parsed.data.eventId) {
        return NextResponse.json(
          { error: 'eventId is required when marking as duplicate' },
          { status: 400 }
        )
      }
      const existing = await prisma.event.findUnique({ where: { id: parsed.data.eventId } })
      if (!existing) {
        return NextResponse.json({ error: 'Linked event not found' }, { status: 404 })
      }
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: 'DUPLICATE',
          reviewedById,
          reviewedAt,
          promotedToEventId: existing.id,
        },
      })
      return NextResponse.json({ success: true, event: existing })
    }
  }
}

/** Generate an event slug from the title with a nanoid suffix to avoid
 *  collisions. Format: lowercased-hyphenated-title-NANOSUFFIX. */
function generateEventSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  const suffix = nanoid(6).toLowerCase()
  return base ? `${base}-${suffix}` : `event-${suffix}`
}
