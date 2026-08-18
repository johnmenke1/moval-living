import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/events/check-tickets-slug?slug=<value>&excludeId=<id>
// Returns { available: boolean, usedByTitle?: string }. Admin-gated.
// Used by EditEventClient for live uniqueness feedback as the admin types.

const SLUG_FORMAT = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const slug = (request.nextUrl.searchParams.get('slug') ?? '').trim()
  const excludeId = request.nextUrl.searchParams.get('excludeId') ?? ''

  if (!slug) {
    return NextResponse.json({ available: false, error: 'Slug is required' }, { status: 400 })
  }
  if (!SLUG_FORMAT.test(slug)) {
    return NextResponse.json({ available: false, error: 'Invalid slug format' }, { status: 400 })
  }

  try {
    const collision = await prisma.event.findFirst({
      where: { ticketsSlug: slug, NOT: excludeId ? { id: excludeId } : undefined },
      select: { id: true, title: true },
    })

    if (collision) {
      return NextResponse.json({ available: false, usedByTitle: collision.title })
    }
    return NextResponse.json({ available: true })
  } catch (err) {
    console.error('[admin/events/check-tickets-slug] error', err)
    return NextResponse.json(
      { available: false, error: err instanceof Error ? err.message : 'Check failed' },
      { status: 500 }
    )
  }
}