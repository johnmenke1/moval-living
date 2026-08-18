import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Server-side 302 redirect from a vanity /tickets/<slug> URL to the
// event's real destination. Lets admins remap a broken ticketUrl by
// editing ticketsSlug (e.g. to fix a renamed Eventbrite link or
// switch providers) without breaking every existing share of the
// /tickets/<slug> link.
//
// Resolution priority:
//   1. event.ticketUrl (if set)
//   2. /events/<event.slug> (event detail page fallback)
//   3. 404 (event not found by ticketsSlug)
//
// `force-dynamic` because every request is a unique lookup by slug.

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params

  if (!slug) {
    return NextResponse.json({ error: 'Missing slug' }, { status: 400 })
  }

  const event = await prisma.event.findFirst({
    where: { ticketsSlug: slug },
    select: { id: true, slug: true, ticketUrl: true },
  })

  if (!event) {
    return NextResponse.json(
      { error: 'Ticket link not found' },
      { status: 404 }
    )
  }

  // If ticketUrl is missing, send the user to the event detail page
  // so they can still find the event. If ticketUrl is set, redirect
  // there with 302 (preserves query string + method for downstream).
  const destination = event.ticketUrl ?? `/events/${event.slug}`

  // Use the request URL as the base so absolute and relative
  // destinations both resolve correctly.
  const absoluteDestination = new URL(destination, req.url)
  return NextResponse.redirect(absoluteDestination, 302)
}
