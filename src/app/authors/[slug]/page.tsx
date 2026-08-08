import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ExternalLink,
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  Clock,
  Calendar,
  Video,
  Award,
} from 'lucide-react'
import {
  LinkedinIcon,
  TwitterIcon,
  FacebookIcon,
  InstagramIcon,
} from '@/components/social/SocialIcons'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { JsonLd } from '@/components/seo/JsonLd'
import { ExpertPartnerBadge } from '@/components/business/ExpertPartnerBadge'
import { ExpertPartnerLeadForm } from '@/components/forms/ExpertPartnerLeadForm'
import { EmbedBadge } from '@/components/partner/EmbedBadge'
import { SiblingPartners } from '@/components/partner/SiblingPartners'
import { formatPhone } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ slug: string }> }

async function getAuthor(slug: string) {
  const author = await prisma.guestAuthor.findUnique({
    where: { slug },
    include: {
      posts: {
        where: { status: 'published', postType: 'GUEST' },
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          heroImageUrl: true,
          publishedAt: true,
        },
      },
      business: {
        include: {
          category: { select: { name: true, slug: true } },
        },
      },
    },
  })
  if (!author || !author.isActive) return null

  // If the author is linked to an Expert Partner business, fetch siblings
  // for the cross-promotion widget. Hidden otherwise.
  let siblingPartners: Array<{
    id: string
    name: string
    slug: string
    expertPartnerSlug: string | null
    tagline: string | null
    logo: string | null
    isExpertPartner: boolean
    foundingPartnerSince: Date | null
    category?: { name: string } | null
  }> = []

  if (author.business?.isExpertPartner) {
    siblingPartners = await prisma.business.findMany({
      where: {
        isExpertPartner: true,
        status: 'APPROVED',
        id: { not: author.business.id },
        ...(author.business.categoryId
          ? { categoryId: { not: author.business.categoryId } }
          : {}),
      },
      orderBy: [
        { foundingPartnerSince: { sort: 'desc', nulls: 'last' } },
        { name: 'asc' },
      ],
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
  }

  return { ...author, siblingPartners }
}

export async function generateMetadata({ params }: Ctx): Promise<Metadata> {
  const { slug } = await params
  const author = await getAuthor(slug)
  if (!author) return { title: 'Not found' }

  const isExpertPartner = !!author.business?.isExpertPartner
  const title = isExpertPartner
    ? `${author.displayName} — Moreno Valley Expert Partner`
    : author.displayName
  const description = author.bio.slice(0, 160)
  const url = `https://www.moval.living/authors/${author.slug}`

  return {
    title,
    description,
    openGraph: {
      type: 'profile',
      url,
      title,
      description,
      images: author.photoUrl
        ? [author.photoUrl]
        : author.business?.logo
          ? [author.business.logo]
          : undefined,
      firstName: author.displayName.split(' ')[0],
      lastName:
        author.displayName.split(' ').slice(1).join(' ') || undefined,
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: author.photoUrl
        ? [author.photoUrl]
        : author.business?.logo
          ? [author.business.logo]
          : undefined,
    },
    alternates: { canonical: url },
  }
}

function formatHours(hours: unknown): Array<{
  day: string
  open: string
  closed: boolean
}> {
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
      const entry = (hours as Record<string, {
        open?: string
        close?: string
        closed?: boolean
      }>)[d]
      return {
        day: dayLabels[d],
        open: entry.closed
          ? 'Closed'
          : `${entry.open || '—'} – ${entry.close || '—'}`,
        closed: !!entry.closed,
      }
    })
}

export default async function AuthorPage({ params }: Ctx) {
  const { slug } = await params
  const author = await getAuthor(slug)
  if (!author) notFound()

  const url = `https://www.moval.living/authors/${author.slug}`
  const business = author.business
  const isExpertPartner = !!business?.isExpertPartner

  // Owner-gating: only the linked business owner sees the embed-badge panel
  const session = await auth()
  const isOwner =
    !!session?.user?.id &&
    !!business?.ownerId &&
    session.user.id === business.ownerId

  const hours = business ? formatHours(business.hours) : []

  // ── Schema.org ──────────────────────────────────────────────────────────
  // Author page is the canonical Person record (the byline authority).
  // If they're an Expert Partner, also emit a LocalBusiness so the
  // business entity has a JSON-LD home that ties to this person via
  // `employee` / `member`.
  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.displayName,
    url,
    ...(author.title ? { jobTitle: author.title } : {}),
    description: author.bio,
    image: author.photoUrl ?? undefined,
    ...(author.companyName
      ? {
          worksFor: {
            '@type': 'Organization',
            name: author.companyName,
            url: author.companyUrl ?? undefined,
          },
        }
      : {}),
    sameAs: [
      author.personalSiteUrl,
      author.companyUrl,
      author.linkedinUrl,
      author.twitterUrl,
      author.facebookUrl,
      author.instagramUrl,
    ].filter((x): x is string => Boolean(x)),
  }

  const businessSchema = isExpertPartner && business
    ? {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        '@id': `https://www.moval.living/authors/${author.slug}#business`,
        name: business.name,
        description: business.description,
        url: `https://www.moval.living/partners/${business.expertPartnerSlug || business.slug}`,
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
        employee: {
          '@type': 'Person',
          name: author.displayName,
          url,
        },
      }
    : null

  const socialLinks = [
    { url: author.linkedinUrl, Icon: LinkedinIcon, label: 'LinkedIn' },
    { url: author.twitterUrl, Icon: TwitterIcon, label: 'Twitter / X' },
    { url: author.facebookUrl, Icon: FacebookIcon, label: 'Facebook' },
    { url: author.instagramUrl, Icon: InstagramIcon, label: 'Instagram' },
    { url: author.personalSiteUrl, Icon: ExternalLink, label: 'Personal site' },
    {
      url: author.companyUrl,
      Icon: Building2,
      label: author.companyName || 'Company',
    },
  ].filter(
    (l): l is { url: string; Icon: typeof LinkedinIcon; label: string } =>
      Boolean(l.url)
  )

  // ── Live Q&A window calculation (copied from /partners/[slug]) ──────────
  const nextDate = business?.liveQaNextDate
    ? new Date(business.liveQaNextDate)
    : null
  const now = new Date()
  const minutesUntil = nextDate
    ? Math.round((nextDate.getTime() - now.getTime()) / 60000)
    : null
  const isLiveWindow =
    minutesUntil !== null && Math.abs(minutesUntil) <= 30
  const zoomMeetingId =
    business?.liveQaZoomUrl?.match(/\/j\/(\d+)/)?.[1] ?? null

  return (
    <>
      <JsonLd schema={personSchema} />
      {businessSchema && <JsonLd schema={businessSchema} />}

      <div className="bg-background min-h-screen">
        <div className="container-max pt-8">
          <Link
            href="/insights"
            className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4" />
            All Insights
          </Link>
        </div>

        <div className="container-max py-12">
          <div className="max-w-6xl mx-auto">
            {/* ── Header ──────────────────────────────────────────────── */}
            <header className="flex flex-col sm:flex-row gap-6 items-start mb-10">
              <div className="w-32 h-32 rounded-full bg-slate-100 overflow-hidden flex-shrink-0">
                {author.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={author.photoUrl}
                    alt={author.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 text-2xl font-bold">
                    {author.displayName
                      .split(' ')
                      .map((p) => p[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex-1">
                {/* Expert Partner badge — only renders when isExpertPartner */}
                {business && (
                  <div className="mb-3">
                    <ExpertPartnerBadge
                      business={{
                        isExpertPartner: business.isExpertPartner,
                        foundingPartnerSince: business.foundingPartnerSince,
                      }}
                      variant="inline"
                    />
                  </div>
                )}

                <h1 className="text-3xl sm:text-4xl font-bold text-text mb-2">
                  {author.displayName}
                </h1>
                {author.title && (
                  <div className="text-lg text-text-secondary mb-1">
                    {author.title}
                  </div>
                )}
                {author.companyName && (
                  <div className="text-base text-text-secondary inline-flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    {author.companyUrl ? (
                      <a
                        href={author.companyUrl}
                        rel="sponsored noopener"
                        target="_blank"
                        className="hover:text-primary"
                      >
                        {author.companyName}
                      </a>
                    ) : (
                      <span>{author.companyName}</span>
                    )}
                  </div>
                )}

                {/* Social links */}
                {socialLinks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {socialLinks.map(({ url: linkUrl, Icon, label }) => (
                      <a
                        key={label}
                        href={linkUrl}
                        rel="sponsored noopener"
                        target="_blank"
                        title={label}
                        className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white border border-slate-200 text-text-secondary hover:text-primary hover:border-primary transition-colors"
                      >
                        <Icon className="w-4 h-4" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </header>

            {/* ── Two-column body (Expert Partner) OR single-column (plain) ── */}
            {isExpertPartner && business ? (
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Left: bio + Live Q&A + hours + posts + embed */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Bio */}
                  <section className="bg-white border border-slate-100 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-text mb-3">About</h2>
                    <p className="text-text leading-relaxed whitespace-pre-line">
                      {author.bio}
                    </p>
                  </section>

                  {/* Live Q&A */}
                  {business.liveQaZoomUrl && (
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
                              {minutesUntil !== null &&
                              minutesUntil > 0 &&
                              minutesUntil <= 60
                                ? `Starts in ${minutesUntil} min — `
                                : minutesUntil !== null &&
                                    minutesUntil <= 0 &&
                                    minutesUntil > -60
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
                                title={`Live Q&A with ${author.displayName}`}
                              />
                              <p className="text-xs text-[#5a6c72] mt-2">
                                Don&apos;t see the meeting?{' '}
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
                  )}

                  {/* Hours */}
                  {hours.length > 0 && (
                    <section className="bg-white border border-slate-200 rounded-xl p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-5 h-5 text-[#007a7f]" />
                        <h2 className="text-xl font-bold text-[#1a2e35]">
                          Hours
                        </h2>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                        {hours.map((h) => (
                          <div
                            key={h.day}
                            className="flex justify-between py-1 border-b border-slate-100 last:border-0"
                          >
                            <span className="text-[#1a2e35] font-medium">
                              {h.day}
                            </span>
                            <span
                              className={
                                h.closed
                                  ? 'text-slate-400'
                                  : 'text-[#5a6c72]'
                              }
                            >
                              {h.open}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Owner-only: Embed badge */}
                  {isOwner && (
                    <EmbedBadge
                      partnerSlug={business.expertPartnerSlug || business.slug}
                      partnerName={business.name}
                    />
                  )}

                  {/* Posts */}
                  <section>
                    <h2 className="text-2xl font-bold text-text mb-4">
                      Posts by {author.displayName.split(' ')[0]}
                      <span className="text-text-secondary font-normal text-base ml-2">
                        ({author.posts.length})
                      </span>
                    </h2>
                    {author.posts.length === 0 ? (
                      <p className="text-text-secondary">No posts yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {author.posts.map((post) => (
                          <article
                            key={post.id}
                            className="bg-white border border-slate-100 rounded-xl p-5 hover:border-primary transition-colors"
                          >
                            <h3 className="text-lg font-bold text-text mb-2">
                              <Link
                                href={`/insights/${post.slug}`}
                                className="hover:text-primary"
                              >
                                {post.title}
                              </Link>
                            </h3>
                            <p className="text-sm text-text-secondary line-clamp-2 mb-2">
                              {post.excerpt}
                            </p>
                            {post.publishedAt && (
                              <div className="text-xs text-text-secondary">
                                {new Date(post.publishedAt).toLocaleDateString(
                                  undefined,
                                  {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                  }
                                )}
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                {/* Right: contact card + lead form + sibling partners */}
                <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
                  <section className="bg-white border border-slate-200 rounded-xl p-6">
                    <h2 className="text-lg font-bold text-[#1a2e35] mb-4">
                      Contact {business.name}
                    </h2>
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
                          {new Date(
                            business.foundingPartnerSince
                          ).toLocaleDateString('en-US', {
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

                  <ExpertPartnerLeadForm
                    businessId={business.id}
                    businessName={business.name}
                  />

                  {author.siblingPartners.length > 0 && (
                    <SiblingPartners partners={author.siblingPartners} />
                  )}
                </aside>
              </div>
            ) : (
              // ── Plain author view (no Expert Partner business linked) ──
              <div className="max-w-3xl">
                {/* Bio */}
                <div className="bg-white border border-slate-100 rounded-xl p-6 mb-10">
                  <p className="text-text leading-relaxed whitespace-pre-line">
                    {author.bio}
                  </p>
                </div>

                {/* Posts */}
                <section>
                  <h2 className="text-2xl font-bold text-text mb-4">
                    Posts by {author.displayName.split(' ')[0]}
                    <span className="text-text-secondary font-normal text-base ml-2">
                      ({author.posts.length})
                    </span>
                  </h2>
                  {author.posts.length === 0 ? (
                    <p className="text-text-secondary">No posts yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {author.posts.map((post) => (
                        <article
                          key={post.id}
                          className="bg-white border border-slate-100 rounded-xl p-5 hover:border-primary transition-colors"
                        >
                          <h3 className="text-lg font-bold text-text mb-2">
                            <Link
                              href={`/insights/${post.slug}`}
                              className="hover:text-primary"
                            >
                              {post.title}
                            </Link>
                          </h3>
                          <p className="text-sm text-text-secondary line-clamp-2 mb-2">
                            {post.excerpt}
                          </p>
                          {post.publishedAt && (
                            <div className="text-xs text-text-secondary">
                              {new Date(post.publishedAt).toLocaleDateString(
                                undefined,
                                {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                }
                              )}
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}