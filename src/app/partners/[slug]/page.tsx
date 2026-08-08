import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import {
  Phone,
  Mail,
  Globe,
  MapPin,
  Clock,
  Calendar,
  Video,
  ArrowLeft,
  Award,
} from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { ExpertPartnerBadge } from '@/components/business/ExpertPartnerBadge'
import { ExpertPartnerLeadForm } from '@/components/forms/ExpertPartnerLeadForm'
import { EmbedBadge } from '@/components/partner/EmbedBadge'
import { SiblingPartners } from '@/components/partner/SiblingPartners'
import { formatPhone } from '@/lib/utils'
import { JsonLd } from '@/components/seo/JsonLd'

interface PartnerPageProps {
  params: Promise<{ slug: string }>
}

async function getPartnerBySlug(slug: string) {
  const partner = await prisma.business.findFirst({
    where: {
      OR: [{ expertPartnerSlug: slug }, { slug, isExpertPartner: true }],
      status: 'APPROVED',
      isExpertPartner: true,
    },
    include: {
      category: { select: { name: true, slug: true } },
    },
  })

  if (!partner) return null

  // Fetch 4 other Expert Partners (different category) for the
    // cross-promotion widget. One per category means we can't have
    // duplicates, so siblings are always from different categories.
    const siblingPartners = await prisma.business.findMany({
      where: {
        isExpertPartner: true,
        status: 'APPROVED',
        id: { not: partner.id },
        // Different category. If partner has no category, all other Expert
        // Partners qualify. If partner has a category, exclude the same id.
        ...(partner.categoryId
          ? { categoryId: { not: partner.categoryId } }
          : {}),
      },
      orderBy: [{ foundingPartnerSince: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
      take: 4,
      select: {
        id: true,
        name: true,
        slug: true,
        expertPartnerSlug: true,
        tagline: true,
        logo: true,
        isExpertPartner: true,
        foundingPartnerSince: true,
        category: { select: { name: true } },
      },
    })

  return { ...partner, siblingPartners }
}

export async function generateMetadata({
  params,
}: PartnerPageProps): Promise<Metadata> {
  const { slug } = await params
  const business = await getPartnerBySlug(slug)
  if (!business) return { title: 'Expert Partner Not Found' }

  const canonicalSlug = business.expertPartnerSlug || business.slug
  const pageUrl = `https://www.moval.living/partners/${canonicalSlug}`
  const title = `${business.name} — Moreno Valley Expert Partner`
  const description =
    business.tagline ||
    business.description.slice(0, 160) ||
    `${business.name} is an Expert Partner on moval.living.`

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: 'profile',
      url: pageUrl,
      title,
      description,
      images: business.coverImage || business.logo
        ? [{ url: business.coverImage || business.logo!, width: 1200, height: 630 }]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

function formatHours(hours: unknown): Array<{ day: string; open: string; closed: boolean }> {
  if (!hours || typeof hours !== 'object') return []
  const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const dayLabels: Record<string, string> = {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday',
  }
  return order
    .filter((d) => d in (hours as Record<string, unknown>))
    .map((d) => {
      const entry = (hours as Record<string, { open?: string; close?: string; closed?: boolean }>)[d]
      return {
        day: dayLabels[d],
        open: entry.closed ? 'Closed' : `${entry.open || '—'} – ${entry.close || '—'}`,
        closed: !!entry.closed,
      }
    })
}

export default async function PartnerProfilePage({ params }: PartnerPageProps) {
  const { slug } = await params
  const business = await getPartnerBySlug(slug)
  if (!business) notFound()

  const hours = formatHours(business.hours)
  const canonicalSlug = business.expertPartnerSlug || business.slug

  // Only the owner sees the "embed your badge" panel — gives them a
  // private space to copy the snippet without cluttering the public view.
  const session = await auth()
  const isOwner =
    !!session?.user?.id &&
    !!business.ownerId &&
    session.user.id === business.ownerId

  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `https://www.moval.living/partners/${canonicalSlug}`,
    name: business.name,
    description: business.description,
    url: `https://www.moval.living/partners/${canonicalSlug}`,
    image: business.coverImage || business.logo || undefined,
    telephone: business.phone || undefined,
    email: business.email || undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: business.address,
      addressLocality: business.city,
      addressRegion: business.state,
      postalCode: business.zip,
      addressCountry: 'US',
    },
    aggregateRating:
      business.googleRating != null && business.googleReviewCount != null
        ? {
            '@type': 'AggregateRating',
            ratingValue: business.googleRating,
            reviewCount: business.googleReviewCount,
          }
        : undefined,
  }

  return (
    <div className="bg-[#f0efeb] min-h-screen">
      {personSchema && <JsonLd schema={personSchema} />}

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-[#007a7f] to-[#00405c] text-white">
        {business.coverImage && (
          <div className="absolute inset-0 opacity-30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={business.coverImage}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-[#007a7f]/80 to-[#00405c]/90" />
          </div>
        )}

        <div className="relative container-max py-12 max-w-6xl mx-auto">
          <Link
            href="/partners"
            className="inline-flex items-center gap-1 text-white/80 hover:text-white text-sm mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            All Expert Partners
          </Link>

          <div className="flex flex-col md:flex-row items-start gap-6">
            {business.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={business.logo}
                alt={`${business.name} logo`}
                className="w-24 h-24 rounded-xl bg-white border-4 border-white shadow-lg object-contain"
              />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-white border-4 border-white shadow-lg flex items-center justify-center">
                <span className="text-4xl font-bold text-[#007a7f]/40">{business.name[0]}</span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="mb-3">
                <ExpertPartnerBadge
                  business={{
                    isExpertPartner: business.isExpertPartner,
                    foundingPartnerSince: business.foundingPartnerSince,
                  }}
                  variant="pill"
                />
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-2">{business.name}</h1>
              {business.tagline && (
                <p className="text-xl text-white/85 mb-2">{business.tagline}</p>
              )}
              <p className="text-white/70 text-sm">
                {business.category.name} · Moreno Valley
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Main content */}
      <div className="container-max py-10 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left: About + Hours + Live Q&A */}
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-xl font-bold text-[#1a2e35] mb-3">About</h2>
              <p className="text-[#1a2e35] whitespace-pre-wrap leading-relaxed">
                {business.description}
              </p>
            </section>

            {/* Live Q&A callout */}
            {/* Live Q&A callout */}
                        {business.liveQaZoomUrl && (() => {
                          const nextDate = business.liveQaNextDate
                            ? new Date(business.liveQaNextDate)
                            : null
                          const now = new Date()
                          // Embed inline only during the 1-hour window around the
                          // scheduled start (30 min before → 30 min after). Outside that
                          // window we just show a join link — embedding all day would
                          // feel spammy and waste Zoom session time.
                          const minutesUntil = nextDate
                            ? Math.round((nextDate.getTime() - now.getTime()) / 60000)
                            : null
                          const isLiveWindow =
                            minutesUntil !== null && Math.abs(minutesUntil) <= 30
                          // Extract the Zoom meeting ID from the URL if it looks like one
                          // (handles /j/1234567890 paths). Falls back to nothing.
                          const zoomMeetingId =
                            business.liveQaZoomUrl.match(/\/j\/(\d+)/)?.[1] ?? null
                          return (
                            <section className="bg-gradient-to-br from-[#007a7f]/5 to-[#00405c]/5 border border-[#007a7f]/20 rounded-xl p-6">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-[#007a7f]/10 flex items-center justify-center flex-shrink-0">
                                  <Video className="w-5 h-5 text-[#007a7f]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-bold text-[#1a2e35] mb-1">
                                    Ask the Expert — Live Q&amp;A
                                  </h3>
                                  {nextDate && (
                                    <p className="text-sm text-[#5a6c72] flex items-center gap-1 mb-2">
                                      <Calendar className="w-3.5 h-3.5" />
                                      {minutesUntil !== null && minutesUntil > 0 && minutesUntil <= 60
                                        ? `Starts in ${minutesUntil} min — `
                                        : minutesUntil !== null && minutesUntil <= 0 && minutesUntil > -60
                                          ? 'Live now — '
                                          : `Next session: `}
                                      {nextDate.toLocaleString('en-US', {
                                        weekday: 'long',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit',
                                      })}
                                    </p>
                                  )}
                                  {isLiveWindow && zoomMeetingId ? (
                                    <div className="mt-3">
                                      <iframe
                                        src={`https://zoom.us/wc/join/${zoomMeetingId}`}
                                        className="w-full h-[480px] rounded-lg border border-slate-200 bg-white"
                                        allow="camera; microphone; fullscreen; display-capture; autoplay"
                                        title={`Live Q&A with ${business.name}`}
                                      />
                                      <p className="text-xs text-[#5a6c72] mt-2">
                                        Don't see the meeting?{' '}
                                        <a
                                          href={business.liveQaZoomUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-[#007a7f] hover:underline font-semibold"
                                        >
                                          Open in Zoom →
                                        </a>
                                      </p>
                                    </div>
                                  ) : (
                                    <a
                                      href={business.liveQaZoomUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-sm font-semibold text-[#007a7f] hover:underline"
                                    >
                                      Join the next session →
                                    </a>
                                  )}
                                </div>
                              </div>
                            </section>
                          )
                        })()}

            {/* Hours */}
            {hours.length > 0 && (
              <section className="bg-white border border-slate-200 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-5 h-5 text-[#007a7f]" />
                  <h2 className="text-xl font-bold text-[#1a2e35]">Hours</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {hours.map((h) => (
                    <div
                      key={h.day}
                      className="flex justify-between py-1 border-b border-slate-100 last:border-0"
                    >
                      <span className="text-[#1a2e35] font-medium">{h.day}</span>
                      <span className={h.closed ? 'text-slate-400' : 'text-[#5a6c72]'}>
                        {h.open}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Owner-only: Embed badge code */}
            {isOwner && (
              <EmbedBadge
                partnerSlug={canonicalSlug}
                partnerName={business.name}
              />
            )}
          </div>

          {/* Right: Contact card + lead form (sticky) */}
          <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            {/* Contact card */}
            <section className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="text-lg font-bold text-[#1a2e35] mb-4">Contact</h2>
              <div className="space-y-3 text-sm">
                {business.phone && (
                  <a
                    href={`tel:${business.phone}`}
                    className="flex items-center gap-2 text-[#007a7f] hover:underline font-medium"
                  >
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    {formatPhone(business.phone)}
                  </a>
                )}
                {business.email && (
                  <a
                    href={`mailto:${business.email}`}
                    className="flex items-center gap-2 text-[#007a7f] hover:underline break-all"
                  >
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    {business.email}
                  </a>
                )}
                {business.website && (
                  <a
                    href={business.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-[#007a7f] hover:underline break-all"
                  >
                    <Globe className="w-4 h-4 flex-shrink-0" />
                    {business.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                <div className="flex items-start gap-2 text-[#1a2e35] pt-2 border-t border-slate-100">
                  <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#5a6c72]" />
                  <span>
                    {business.address}
                    <br />
                    {business.city}, {business.state} {business.zip}
                  </span>
                </div>
              </div>

              {business.foundingPartnerSince && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-xs text-amber-700 font-semibold">
                    <Award className="w-3.5 h-3.5" />
                    Founding Partner since{' '}
                    {new Date(business.foundingPartnerSince).toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                  <p className="text-xs text-[#5a6c72] mt-1">
                    Locked in at the original $997/yr rate.
                  </p>
                </div>
              )}
            </section>

            {/* Lead capture form */}
                        <ExpertPartnerLeadForm
                          businessId={business.id}
                          businessName={business.name}
                        />

                        {/* Cross-promotion: Other MoVal Experts */}
                        <SiblingPartners partners={business.siblingPartners} />
                      </aside>
        </div>
      </div>
    </div>
  )
}