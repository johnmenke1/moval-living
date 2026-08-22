import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { averageRating, formatPhone } from '@/lib/utils'
import { MapPin, Phone, Globe, Mail, Clock, Star, ChevronRight, Trophy, Tag, Award, Sparkles, Building2, Languages } from 'lucide-react'
import { BusinessMapWrapper } from '@/components/map/BusinessMapWrapper'
import { BusinessSidebar } from '@/components/business/BusinessSidebar'
import { JsonLd } from '@/components/seo/JsonLd'
import { cn } from '@/lib/utils'
import { publicDescription } from '@/lib/display'

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  )
}
import { ReviewList } from '@/components/reviews/ReviewList'
import { ContactBusinessForm } from '@/components/forms/ContactBusinessForm'
import type { Metadata } from 'next'

interface BusinessPageProps {
  params: Promise<{ slug: string }>
}

async function getBusiness(slug: string) {
  const business = await prisma.business.findUnique({
    where: { slug, status: 'APPROVED' },
    select: {
      id: true, slug: true, name: true, tagline: true, description: true,
      address: true, city: true, state: true, zip: true,
      phone: true, email: true, website: true,
      coverImage: true, logo: true, photos: true,
      facebook: true, instagram: true, yelp: true,
      googleBusiness: true, googleRating: true, googleReviewCount: true,
      hours: true, status: true, tier: true,
      hasCoupon: true, coupon: true,
      isBestOfWinner: true,
      isExpertPartner: true,
      expertPartnerSlug: true,
      foundingPartnerSince: true,
      foundingPartnerRate: true,
      // Languages & Chamber affiliation badges
      seHablaEspanol: true,
      chamberMember: true,
      hispanicChamberMember: true,
      metaTitle: true, metaDescription: true,
      category: true,
      ownerId: true,
      reviews: {
        orderBy: { createdAt: 'desc' },
        where: { flagged: false },
      },
      // All Best Of categories this business has been nominated in
      // (winners AND runner-ups). Drives the Best Of badge on the listing.
      bestOfNominees: {
        select: {
          winner: true,
          category: {
            select: { name: true, slug: true },
          },
        },
      },
    },
  })
  return business
}

export async function generateMetadata({ params }: BusinessPageProps): Promise<Metadata> {
  const { slug } = await params
  const business = await getBusiness(slug)
  if (!business) return { title: 'Business Not Found' }

  const pageUrl = `https://www.moval.living/business/${slug}`
  const description = business.metaDescription || publicDescription(business).slice(0, 160)

  return {
    title: business.metaTitle || business.name,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: 'profile',
      url: pageUrl,
      title: business.metaTitle || business.name,
      description,
      images: business.coverImage || business.logo
        ? [{ url: business.coverImage || business.logo!, width: 1200, height: 630 }]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: business.metaTitle || business.name,
      description,
      images: business.coverImage || business.logo ? [business.coverImage || business.logo!] : [],
    },
  }
}

function buildBusinessSchema(business: Awaited<ReturnType<typeof getBusiness>> & { reviews: Array<{ rating: number }> }) {
  if (!business) return null

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `https://www.moval.living/business/${business.slug}`,
    name: business.name,
    description: publicDescription(business),
    url: `https://www.moval.living/business/${business.slug}`,
  }

  if (business.logo) schema.logo = { '@type': 'ImageObject', url: business.logo }
  if (business.coverImage) schema.image = business.coverImage
  if (business.email) schema.email = business.email
  if (business.phone) schema.telephone = business.phone

  // Address
  if (business.address || business.city || business.state || business.zip) {
    schema.address = {
      '@type': 'PostalAddress',
      ...(business.address && { streetAddress: business.address }),
      ...(business.city && { addressLocality: business.city }),
      ...(business.state && { addressRegion: business.state }),
      ...(business.zip && { postalCode: business.zip }),
      addressCountry: 'US',
    }
  }

  // sameAs — external cross-references for entity consolidation.
  // External website lives here (NOT in url — url must anchor to the
  // listing page so Google resolves the entity to moval.living instead
  // of splitting it across domains).
  const sameAs: string[] = []
  if (business.website) sameAs.push(business.website)
  if (business.facebook) sameAs.push(business.facebook)
  if (business.instagram) sameAs.push(business.instagram)
  if (business.yelp) sameAs.push(business.yelp)
  if (business.googleBusiness) sameAs.push(`https://www.google.com/maps?cid=${business.googleBusiness}`)
  if (sameAs.length > 0) schema.sameAs = sameAs

  // Aggregate rating
  if (business.googleRating != null && business.googleReviewCount != null) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: business.googleRating,
      reviewCount: business.googleReviewCount,
      bestRating: 5,
      worstRating: 1,
    }
  }

  // Category
  if (business.category) schema.category = business.category.name

  // Area served
  schema.areaServed = {
    '@type': 'City',
    name: 'Moreno Valley',
    addressRegion: 'CA',
    addressCountry: 'US',
  }

  // Opening hours
  if (business.hours) {
    const hrs = business.hours as Record<string, { open: string; close: string; closed: boolean }>
    const dayMap: Record<string, string> = {
      monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday',
      thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday', sunday: 'Sunday',
    }
    schema.openingHoursSpecification = Object.entries(hrs)
      .filter(([, h]) => !h.closed)
      .map(([day, h]) => ({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: dayMap[day.toLowerCase()] ?? day,
        opens: h.open,
        closes: h.close,
      }))
  }

  return schema
}

function buildBreadcrumbSchema(business: { name: string; slug: string; category: { name: string; slug: string } }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.moval.living' },
      { '@type': 'ListItem', position: 2, name: 'Browse', item: 'https://www.moval.living/search' },
      {
        '@type': 'ListItem',
        position: 3,
        name: business.category.name,
        item: `https://www.moval.living/search?category=${business.category.slug}`,
      },
      { '@type': 'ListItem', position: 4, name: business.name, item: `https://www.moval.living/business/${business.slug}` },
    ],
  }
}

export default async function BusinessPage({ params }: BusinessPageProps) {
  const { slug } = await params
  const business = await getBusiness(slug)
  if (!business) notFound()

  const rating = averageRating(business.reviews)
  const hours = business.hours as Record<string, { open: string; close: string; closed: boolean }> | null
  const localBusinessSchema = buildBusinessSchema(business)
  const breadcrumbSchema = buildBreadcrumbSchema(business)

  return (
    <>
      {localBusinessSchema && <JsonLd schema={localBusinessSchema} />}
      {breadcrumbSchema && <JsonLd schema={breadcrumbSchema} />}
      <div className="bg-slate-50 min-h-screen">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-slate-100">
        <div className="container-max py-3">
          <nav className="flex items-center gap-2 text-sm text-text-secondary">
            <Link href="/" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href="/search" className="hover:text-primary transition-colors">Browse</Link>
            <ChevronRight className="w-4 h-4" />
            <Link href={`/search?category=${business.category.slug}`} className="hover:text-primary transition-colors">
              {business.category.name}
            </Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-text font-medium truncate">{business.name}</span>
          </nav>
        </div>
      </div>

      <div className="container-max py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* ─── MAIN CONTENT ─── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              {/* Cover Image — falls back to logo (centered, no crop) if no cover set */}
              <div className="relative h-56 md:h-72 bg-gradient-to-br from-primary/20 to-secondary/20">
                {business.coverImage || business.logo ? (
                  <img
                    src={business.coverImage || business.logo!}
                    alt={business.name}
                    className={
                      // Square logo in wide hero: contain+center so it doesn't get cropped.
                      // Cover images are wide and should fill the hero normally.
                      !business.coverImage && business.logo
                        ? 'w-full h-full object-contain p-8'
                        : 'w-full h-full object-cover'
                    }
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-7xl font-bold text-primary/20">{business.name[0]}</span>
                  </div>
                )}
                {business.tier === 'FEATURED' && (
                  <div className="absolute top-4 left-4 bg-accent text-white text-sm font-bold px-3 py-1.5 rounded-full">
                    ⭐ Featured Business
                  </div>
                )}
              </div>

              <div className="p-6 md:p-8">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
                  {business.logo && (
                    // relative + z-10 keeps the logo above the cover image,
                    // since both render in normal flow and the cover image
                    // would otherwise paint over the negative-margin logo.
                    <img
                      src={business.logo}
                      alt={`${business.name} logo`}
                      className="relative z-10 w-20 h-20 rounded-xl object-cover border-2 border-white shadow-md -mt-14 sm:-mt-16 mb-2 sm:mb-0 bg-white"
                    />
                  )}
                  <div className="flex-1">
                    <h1 className="text-2xl md:text-3xl font-bold text-text mb-1">{business.name}</h1>
                    {business.tagline && <p className="text-accent font-medium text-lg mb-2">{business.tagline}</p>}

                    {/* Badge row — mirrors the home card layout you liked.
                        Featured pill stays overlaid on the cover image;
                        Best Of, Expert Partner, and Deal live here. */}
                    {(business.tier === 'FEATURED' || business.tier === 'EXPERT_PARTNER' ||
                      business.isExpertPartner || business.isBestOfWinner ||
                      (business.bestOfNominees && business.bestOfNominees.length > 0) ||
                      business.hasCoupon || business.seHablaEspanol) && (
                      <BusinessBadgesRow
                        tier={business.tier}
                        isExpertPartner={business.isExpertPartner}
                        foundingPartnerSince={business.foundingPartnerSince}
                        bestOfWinner={business.isBestOfWinner}
                        bestOfNominationCount={business.bestOfNominees?.length ?? 0}
                        hasCoupon={business.hasCoupon}
                        seHablaEspanol={business.seHablaEspanol}
                      />
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary mt-3">
                      <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">{business.category.name}</span>
                      {rating > 0 && (
                        <div className="flex items-center gap-1">
                          {[1,2,3,4,5].map(star => (
                            <Star key={star} className={`w-4 h-4 ${star <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                          ))}
                          <span className="font-medium text-text ml-1">{rating.toFixed(1)}</span>
                          <span>({business.reviews.length} review{business.reviews.length !== 1 ? 's' : ''})</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description — never renders raw import text ("OSM
                    import: …"); placeholder descriptions fall back to a
                    neutral category line via publicDescription(). */}
                <div className="prose prose-slate max-w-none mb-8">
                  <p className="text-text-secondary leading-relaxed whitespace-pre-line">{publicDescription(business)}</p>
                </div>

                {/* Community & Affiliations — chamber memberships and
                    language get real estate here instead of shouting from
                    the badge row. */}
                {(business.chamberMember || business.hispanicChamberMember || business.seHablaEspanol) && (
                  <div className="mb-8">
                    <h3 className="font-semibold text-text mb-3">Community &amp; Affiliations</h3>
                    <div className="flex flex-wrap gap-3">
                      {business.chamberMember && (
                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-white">
                            <Building2 className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-text leading-tight">Moreno Valley Chamber of Commerce</p>
                            <p className="text-xs text-text-secondary">Member</p>
                          </div>
                        </div>
                      )}
                      {business.hispanicChamberMember && (
                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
                            <Globe className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-text leading-tight">MV Hispanic Chamber of Commerce</p>
                            <p className="text-xs text-text-secondary">Member</p>
                          </div>
                        </div>
                      )}
                      {business.seHablaEspanol && (
                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white">
                            <Languages className="h-4 w-4" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-text leading-tight">Se habla español</p>
                            <p className="text-xs text-text-secondary">Atención en español</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Photo Gallery */}
                {business.photos && business.photos.length > 0 && (
                  <div className="mb-8">
                    <h3 className="font-semibold text-text mb-3">Photos</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {business.photos.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block aspect-square rounded-xl overflow-hidden border border-slate-200 hover:border-primary transition-colors group"
                        >
                          <img
                            src={url}
                            alt={`${business.name} photo ${i + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {business.address && (
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                      <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-text">Address</p>
                        <p className="text-sm text-text-secondary">{business.address}</p>
                        <p className="text-sm text-text-secondary">{business.city}, {business.state} {business.zip}</p>
                      </div>
                    </div>
                  )}
                  {business.phone && (
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                      <Phone className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-text">Phone</p>
                        <a href={`tel:${business.phone}`} className="text-sm text-primary hover:underline">{formatPhone(business.phone)}</a>
                      </div>
                    </div>
                  )}
                  {business.email && (
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                      <Mail className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-text">Email</p>
                        <a href={`mailto:${business.email}`} className="text-sm text-primary hover:underline">{business.email}</a>
                      </div>
                    </div>
                  )}
                  {business.website && (
                    <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl">
                      <Globe className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-text">Website</p>
                        <a href={business.website} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                          {business.website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Hours */}
                {hours && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-text mb-3 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-primary" />
                      Hours of Operation
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(hours).map(([day, hours]) => (
                        <div key={day} className="text-sm p-3 bg-slate-50 rounded-lg">
                          <p className="font-medium text-text capitalize">{day}</p>
                          <p className="text-text-secondary">
                            {hours.closed ? 'Closed' : `${hours.open} – ${hours.close}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Social Links */}
                {(business.facebook || business.instagram || business.yelp || business.googleBusiness) && (
                  <div className="flex flex-wrap gap-3">
                    {business.facebook && (
                      <a href={business.facebook} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                        <FacebookIcon className="w-4 h-4" /> Facebook
                      </a>
                    )}
                    {business.instagram && (
                      <a href={business.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors text-sm font-medium">
                        <InstagramIcon className="w-4 h-4" /> Instagram
                      </a>
                    )}
                    {business.yelp && (
                      <a href={business.yelp} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium">
                        Y
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Map */}
            {business.address && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6">
                  <h2 className="text-xl font-bold text-text mb-4 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    Location
                  </h2>
                </div>
                <div className="h-72 min-h-[288px]">
                                  <BusinessMapWrapper
                                    address={business.address}
                                    city={business.city}
                                    state={business.state}
                                    zip={business.zip}
                                    name={business.name}
                                  />
                                </div>
              </div>
            )}

            {/* Reviews */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
              <ReviewList
              businessId={business.id}
              businessSlug={business.slug}
              initialReviews={business.reviews}
              googleBusinessId={business.googleBusiness}
              googleRating={business.googleRating}
              googleReviewCount={business.googleReviewCount}
              googleMapsUrl={
                business.googleBusiness
                  ? `https://www.google.com/maps?cid=${encodeURIComponent(business.googleBusiness)}`
                  : null
              }
            />
            </div>
          </div>

          {/* ─── SIDEBAR ─── */}
          <div className="space-y-6">
            {/* Contact Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="text-lg font-bold text-text mb-4">Contact {business.name}</h3>
              <ContactBusinessForm businessName={business.name} businessSlug={business.slug} />
            </div>

            <BusinessSidebar business={business} />
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

// ── Badge row below the business name ───────────────────────────────────────
//
// Mirrors the layout used on the home page BusinessCard: Featured pill
// stays overlaid on the cover; Best Of, Expert Partner, and Deal live
// in this row. Founding Expert Partners get the richer amber treatment.

function BusinessBadgesRow({
  tier,
  isExpertPartner,
  foundingPartnerSince,
  bestOfWinner,
  bestOfNominationCount,
  hasCoupon,
  seHablaEspanol,
}: {
  tier: string
  isExpertPartner: boolean
  foundingPartnerSince: string | Date | null
  bestOfWinner: boolean
  bestOfNominationCount: number
  hasCoupon: boolean
  seHablaEspanol: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      {bestOfWinner && (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
          <Trophy className="w-3 h-3" />
          Best of MoVal Winner
        </span>
      )}
      {!bestOfWinner && bestOfNominationCount > 0 && (
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-text-secondary border border-slate-200">
          <Trophy className="w-3 h-3" />
          Best Of Nominee
        </span>
      )}
      {isExpertPartner && (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border shadow-sm',
            foundingPartnerSince
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-amber-600'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          )}
          title={foundingPartnerSince ? 'Founding Expert Partner' : 'Expert Partner'}
        >
          {foundingPartnerSince ? (
            <Sparkles className="w-3 h-3" />
          ) : (
            <Award className="w-3 h-3" />
          )}
          {foundingPartnerSince ? 'Founding Expert Partner' : 'Expert Partner'}
        </span>
      )}
      {hasCoupon && (
        <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-primary text-white">
          <Tag className="w-3 h-3" />
          Deal Available
        </span>
      )}
      {/* Chamber membership and language moved to the Community &
          Affiliations block below the description — the badge row stays
          capped at the award-type signals. A quiet Español chip remains
          here since language matters at the moment of choosing. */}
      {seHablaEspanol && (
        <span
          className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/25"
          title="Atención en español — staff speaks Spanish"
        >
          <Languages className="w-3 h-3" />
          Español
        </span>
      )}
      {/* Note: FEATURED / EXPERT_PARTNER tier pills stay on the cover image. */}
      {(tier === 'EXPERT_PARTNER' || tier === 'FEATURED') && !isExpertPartner && (
        <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-accent/10 text-accent border border-accent/20">
          <Award className="w-3 h-3" />
          {tier === 'EXPERT_PARTNER' ? 'Expert Partner Tier' : 'Featured Tier'}
        </span>
      )}
    </div>
  )
}
