import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { revalidateEventData } from '@/lib/revalidate'

// PATCH /api/admin/events/[id]/archive
// Body: { archived: boolean }
// Toggles Event.archivedAt. Setting archivedAt back to null un-archives
// the event so it shows in public listings again.

const schema = z.object({
  archived: z.boolean(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const existing = await prisma.event.findUnique({
    where: { id },
    select: { id: true, archivedAt: true, slug: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const updated = await prisma.event.update({
    where: { id },
    data: { archivedAt: parsed.data.archived ? new Date() : null },
    select: { id: true, slug: true, archivedAt: true },
  })

  // Revalidate the public events page so the change is visible immediately.
  // ISR cache bust — see src/lib/revalidate.ts for the path map.
  revalidateEventData()
  return NextResponse.json({
    event: {
      id: updated.id,
      slug: updated.slug,
      archivedAt: updated.archivedAt?.toISOString() ?? null,
    },
  })
}