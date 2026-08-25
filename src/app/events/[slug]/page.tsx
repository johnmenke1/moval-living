import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildEvent } from '@/lib/seo-schema'
import {
  Calendar,
  MapPin,
  ExternalLink,
  ArrowLeft,
  Ticket,
  Building2,
  Users,
} from 'lucide-react'
import { RsvpButtons } from './RsvpButtons'

interface PageProps {
  params: Promise<{ slug: string }>
}

// Detail pages change every admin edit and RSVP; never prerender, always read live.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      title: true,
      description: true,
      heroImageUrl: true,
      startsAt: true,
      venueName: true,
      city: true,
    },
  })
  if (!event) return { title: 'Event not found' }

  const description = (event.description ?? '').slice(0, 160) ||
    `${event.title} — ${formatDetailDate(event.startsAt)}`

  return {
    title: `${event.title} — Events on moval.living`,
    description,
    alternates: { canonical: `https://www.moval.living/events/${slug}` },
    openGraph: {
      title: event.title,
      description,
      url: `https://www.moval.living/events/${slug}`,
      type: 'article',
      images: event.heroImageUrl ? [{ url: event.heroImageUrl }] : undefined,
    },
  }
}

export default async function EventDetailPage({ params }: PageProps) {
  const { slug } = await params
  const event = await prisma.event.findUnique({
    where: { slug },
    include: { business: { select: { slug: true, name: true } } },
  })

  if (!event || event.archivedAt) notFound()

  const session = await auth()
  const isAuthenticated = Boolean(session?.user?.id)

  // Aggregate RSVP counts and, if logged in, the current user's status.
  const [attendeeCounts, myAttendee, attendees] = await Promise.all([
    prisma.eventAttendee.groupBy({
      by: ['status'],
      where: { eventId: event.id },
      _count: { status: true },
    }),
    isAuthenticated
      ? prisma.eventAttendee.findUnique({
          where: {
            eventId_ownerId: {
              eventId: event.id,
              ownerId: session!.user!.id,
            },
          },
          select: { status: true },
        })
      : null,
    prisma.eventAttendee.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'asc' },
      take: 24,
      select: {
        status: true,
        owner: { select: { id: true, name: true, image: true } },
      },
    }),
  ])

  const goingCount = attendeeCounts.find((c) => c.status === 'GOING')?._count.status ?? 0
  const interestedCount = attendeeCounts.find((c) => c.status === 'INTERESTED')?._count.status ?? 0
  const myStatus = myAttendee?.status ?? null

  // Schema.org Event JSON-LD (server-rendered so AI crawlers see it).
  const eventSchema = buildEvent({
    type: 'Event',
    name: event.title,
    description: event.description ?? event.title,
    startDate: event.startsAt.toISOString(),
    endDate: (event.endsAt ?? event.startsAt).toISOString(),
    eventStatus: 'EventScheduled',
    eventAttendanceMode: 'OfflineEventAttendanceMode',
    location:
      event.address || event.city || event.state || event.zip || event.venueName
        ? {
            type: 'Place',
            name: event.venueName ?? undefined,
            address: {
              streetAddress: event.address ?? '',
              addressLocality: event.city ?? '',
              addressRegion: event.state ?? '',
              postalCode: event.zip ?? '',
              addressCountry: 'US',
            },
          }
        : undefined,
    organizer: event.business?.name
      ? {
          type: 'Organization',
          name: event.business.name,
          url: event.business.slug
            ? `https://www.moval.living/business/${event.business.slug}`
            : undefined,
        }
      : undefined,
    image: event.heroImageUrl ?? undefined,
    offers:
      event.ticketUrl && !event.isFree
        ? {
            price: '0',
            priceCurrency: 'USD',
            url: event.ticketUrl,
            availability: 'https://schema.org/InStock',
          }
        : event.isFree
          ? {
              price: '0',
              priceCurrency: 'USD',
              availability: 'https://schema.org/InStock',
            }
          : undefined,
  })

  // CTAs: prefer shareUrl → ticketUrl → sourceUrl. Internal /business link
  // lives separately in the host section below.
  const primaryCta = pickCta(event)
  const hostBusiness = event.business

  // Related events at the same venue or in the same category.
  const relatedOrClauses: any[] = []
  if (event.venueId) relatedOrClauses.push({ venueId: event.venueId })
  else if (event.venueName) relatedOrClauses.push({ venueName: event.venueName })
  if (event.category) relatedOrClauses.push({ category: event.category })
  else if (event.city) relatedOrClauses.push({ city: event.city })

  const related = relatedOrClauses.length > 0
    ? await prisma.event.findMany({
        where: {
          slug: { not: event.slug },
          archivedAt: null,
          OR: relatedOrClauses,
        },
        orderBy: { startsAt: 'asc' },
        take: 6,
        select: {
          id: true,
          slug: true,
          title: true,
          heroImageUrl: true,
          startsAt: true,
          venueName: true,
          category: true,
        },
      })
    : []

  return (
    <>
      <JsonLd schema={eventSchema} />

      <div className="bg-background min-h-screen">
        {/* Hero — full-bleed image with overlaid title */}
        <div className="relative bg-secondary overflow-hidden">
          {event.heroImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.heroImageUrl}
              alt={event.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary" aria-hidden="true" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" aria-hidden="true" />

          <div className="relative z-10 container-max py-12 sm:py-16">
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to events
            </Link>

            <div className="max-w-3xl">
              <p className="text-xs font-bold text-accent uppercase tracking-wider mb-2">
                {formatDetailDate(event.startsAt)}
              </p>
              <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4 leading-tight">
                {event.title}
              </h1>
              {event.venueName && (
                <p className="text-white/90 text-base sm:text-lg flex items-center gap-2 flex-wrap">
                  <MapPin className="w-4 h-4 shrink-0" />
                  {event.venueName}
                  {event.city && event.city !== 'Moreno Valley' && (
                    <span className="text-white/70"> · {event.city}</span>
                  )}
                </p>
              )}
              <div className="mt-4 flex items-center gap-3 text-white/80 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  {goingCount} going
                </span>
                {interestedCount > 0 && (
                  <span className="text-white/60">· {interestedCount} interested</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="container-max py-10 sm:py-12">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Description */}
            <div className="lg:col-span-2 space-y-6">
              {event.description ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
                  <h2 className="text-xl font-bold text-text mb-4">About this event</h2>
                  <p className="text-text leading-relaxed whitespace-pre-line">
                    {event.description}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
                  <p className="text-text-secondary italic">
                    No description provided. Use the primary action below for full details.
                  </p>
                </div>
              )}

              {/* Attendee list */}
              {attendees.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
                  <h2 className="text-xl font-bold text-text mb-4 flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Who&apos;s coming
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {attendees.map((a) => (
                      <div
                        key={a.owner.id}
                        className="flex items-center gap-2 bg-slate-50 rounded-full pl-1 pr-3 py-1 border border-slate-100"
                        title={a.status === 'GOING' ? 'Going' : 'Interested'}
                      >
                        {a.owner.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.owner.image}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {(a.owner.name ?? 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm text-text font-medium">
                          {a.owner.name ?? 'A guest'}
                        </span>
                        {a.status === 'INTERESTED' && (
                          <span className="text-[10px] text-text-secondary">interested</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Host business */}
              {hostBusiness && (
                <Link
                  href={`/business/${hostBusiness.slug}`}
                  className="block bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 hover:border-primary/40 transition-colors"
                >
                  <p className="text-xs uppercase font-bold tracking-wider text-text-secondary mb-2 flex items-center gap-2">
                    <Building2 className="w-4 h-4" /> Hosted by
                  </p>
                  <p className="text-lg font-semibold text-text hover:text-primary transition-colors">
                    {hostBusiness.name}
                  </p>
                  <p className="text-sm text-primary mt-1 flex items-center gap-1">
                    View business listing <ExternalLink className="w-3 h-3" />
                  </p>
                </Link>
              )}

              {/* Related events */}
              {related.length > 0 && (
                <div>
                  <h2 className="text-xs uppercase font-bold tracking-wider text-text-secondary mb-3">
                    More at this venue or in this category
                  </h2>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {related.map((r) => (
                      <Link
                        key={r.id}
                        href={`/events/${r.slug}`}
                        className="block bg-white rounded-xl border border-slate-100 overflow-hidden hover:border-primary/30 transition-colors group"
                      >
                        <div className="aspect-[16/9] bg-gradient-to-br from-primary/10 to-secondary/10 relative">
                          {r.heroImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.heroImageUrl}
                              alt={r.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Calendar className="w-8 h-8 text-primary/30" />
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <p className="text-xs font-bold text-primary uppercase mb-1 tracking-wide">
                            {formatDetailDate(r.startsAt)}
                          </p>
                          <p className="text-sm font-semibold text-text line-clamp-2 group-hover:text-primary transition-colors">
                            {r.title}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar — details + CTA + RSVP */}
            <aside className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h2 className="text-xs uppercase font-bold tracking-wider text-text-secondary mb-3">
                  Event details
                </h2>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                    <dd>
                      <p className="text-text">{formatDetailDate(event.startsAt)}</p>
                      {event.endsAt && event.endsAt.getTime() !== event.startsAt.getTime() && (
                        <p className="text-text-secondary text-xs mt-0.5">
                          Ends {formatDetailDate(event.endsAt)}
                        </p>
                      )}
                    </dd>
                  </div>
                  {event.venueName && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                      <dd>
                        <p className="text-text">{event.venueName}</p>
                        {(event.address || event.city) && (
                          <p className="text-text-secondary text-xs mt-0.5">
                            {[event.address, event.city, event.state, event.zip]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        )}
                      </dd>
                    </div>
                  )}
                  {event.startsAt && (
                    <div className="flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-text-secondary mt-0.5 shrink-0" />
                      <dd>
                        <p className="text-text">
                          {event.startsAt.toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            timeZone: 'America/Los_Angeles',
                          })}
                          {' PT'}
                        </p>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <RsvpButtons
                slug={slug}
                initialStatus={myStatus}
                goingCount={goingCount}
                interestedCount={interestedCount}
                isAuthenticated={isAuthenticated}
              />

              {/* Primary CTA — pick the most actionable link */}
              {primaryCta && (
                <a
                  href={primaryCta.href}
                  target={primaryCta.external ? '_blank' : undefined}
                  rel={primaryCta.external ? 'noopener noreferrer' : undefined}
                  className="flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl bg-secondary text-white font-semibold hover:bg-secondary/90 transition-colors"
                >
                  {primaryCta.icon === 'ticket' ? <Ticket className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                  {primaryCta.label}
                </a>
              )}
            </aside>
          </div>
        </div>
      </div>
    </>
  )
}

function formatDetailDate(d: Date): string {
  return d.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
  })
}

function pickCta(event: {
  shareUrl: string | null
  ticketUrl: string | null
  sourceUrl: string | null
}): { href: string; external: boolean; label: string; icon: 'ticket' | 'link' } | null {
  if (event.shareUrl) {
    return { href: event.shareUrl, external: true, label: 'View event page', icon: 'link' }
  }
  if (event.ticketUrl) {
    return { href: event.ticketUrl, external: true, label: 'Get tickets', icon: 'ticket' }
  }
  if (event.sourceUrl) {
    return { href: event.sourceUrl, external: true, label: 'Event details', icon: 'link' }
  }
  return null
}
