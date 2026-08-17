import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { JsonLd } from '@/components/seo/JsonLd'
import { ArrowLeft, MapPin, Phone, Globe, Star, Clock } from 'lucide-react'
import { AMENITIES } from '@/lib/park-amenities'
import type { ParkType } from '@/lib/parks'
import { typeLabel } from '@/lib/parks'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ slug: string }>
}

const BASE_URL = 'https://www.moval.living'

async function getPark(slug: string) {
  return prisma.park.findFirst({
    where: { slug, isActive: true },
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const park = await getPark(slug)
  if (!park) return { title: 'Park Not Found — MoVal Living' }

  const description = park.blurb ?? park.description?.slice(0, 160) ?? `${typeLabel(park.type as ParkType)} in Moreno Valley, CA.`

  return {
    title: `${park.name} — Parks in Moreno Valley`,
    description,
    alternates: { canonical: `${BASE_URL}/parks/${park.slug}` },
    openGraph: {
      type: 'website',
      url: `${BASE_URL}/parks/${park.slug}`,
      title: `${park.name} — MoVal Living`,
      description,
      images: park.heroPhotoUrl
        ? [{ url: park.heroPhotoUrl, alt: park.name }]
        : [],
    },
  }
}

export default async function ParkDetailPage({ params }: Props) {
  const { slug } = await params
  const park = await getPark(slug)
  if (!park) notFound()

  // Schema.org Place — best possible SEO surface for a park.
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Park',
    name: park.name,
    description: park.description ?? park.blurb ?? undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: park.address ?? undefined,
      addressLocality: park.city,
      addressRegion: park.state,
      postalCode: park.zip ?? undefined,
      addressCountry: 'US',
    },
    ...(park.latitude != null && park.longitude != null
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: park.latitude,
            longitude: park.longitude,
          },
        }
      : {}),
    ...(park.phone ? { telephone: park.phone } : {}),
    ...(park.website ? { url: park.website } : {}),
    ...(park.googleRating != null
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: park.googleRating,
            reviewCount: park.googleReviewCount ?? 0,
          },
        }
      : {}),
  }

  const heroSrc = park.heroPhotoUrl ?? park.photoUrls[0] ?? null
  const amenities = AMENITIES.filter((a) => park.amenities.includes(a.slug))

  return (
    <>
      <JsonLd schema={schema} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <Link
          href="/parks"
          className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-primary mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> All parks
        </Link>

        {/* Hero image */}
        {heroSrc && (
          <div className="relative w-full aspect-[21/9] rounded-2xl overflow-hidden bg-slate-100 mb-6">
            <Image
              src={heroSrc}
              alt={park.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
            />
          </div>
        )}

        {/* Headline */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-xs font-bold uppercase tracking-wide rounded bg-primary/10 text-primary">
                {typeLabel(park.type as ParkType)}
              </span>
            </div>
            <h1
              className="text-3xl font-bold text-text"
              style={{ fontFamily: 'var(--font-fraunces), Inter, sans-serif' }}
            >
              {park.name}
            </h1>
            {park.blurb && (
              <p className="text-text-secondary mt-2 max-w-2xl">{park.blurb}</p>
            )}
          </div>
          {park.googleRating != null && (
            <div className="flex flex-col items-end">
              <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200">
                <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                <span className="font-bold text-amber-900">{park.googleRating.toFixed(1)}</span>
                {park.googleReviewCount != null && (
                  <span className="text-xs text-amber-700 ml-1">
                    ({park.googleReviewCount})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Amenities */}
            {amenities.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h2 className="font-bold text-text mb-3">Amenities</h2>
                <ul className="flex flex-wrap gap-2">
                  {amenities.map((a) => (
                    <li
                      key={a.slug}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-semibold"
                    >
                      {a.label}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Description */}
            {park.description && (
              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h2 className="font-bold text-text mb-3">About</h2>
                <p className="text-text whitespace-pre-line">{park.description}</p>
              </section>
            )}

            {/* Photo gallery */}
            {park.photoUrls.length > 1 && (
              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h2 className="font-bold text-text mb-3">Photos ({park.photoUrls.length})</h2>
                <div className="grid grid-cols-3 gap-2">
                  {park.photoUrls.slice(0, 9).map((url) => (
                    <div
                      key={url}
                      className="relative aspect-square rounded-lg overflow-hidden bg-slate-100"
                    >
                      <Image
                        src={url}
                        alt=""
                        fill
                        sizes="200px"
                        className="object-cover hover:scale-105 transition-transform"
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-4">
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="font-bold text-text mb-3">Details</h2>
              <dl className="flex flex-col gap-3 text-sm">
                {park.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${park.name}, ${park.address}, ${park.city}, ${park.state} ${park.zip ?? ''}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary"
                    >
                      {park.address}
                      <br />
                      <span className="text-text-secondary">
                        {park.city}, {park.state} {park.zip}
                      </span>
                    </a>
                  </div>
                )}
                {park.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                    <a href={`tel:${park.phone}`} className="hover:text-primary">
                      {park.phone}
                    </a>
                  </div>
                )}
                {park.website && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-primary flex-shrink-0" />
                    <a
                      href={park.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary truncate"
                    >
                      Visit website
                    </a>
                  </div>
                )}
              </dl>
            </section>

            {/* Map (static image if no API key, else iframe) */}
            {park.latitude != null && park.longitude != null && (
              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <iframe
                  title={`${park.name} map`}
                  className="w-full h-64"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://maps.google.com/maps?q=${park.latitude},${park.longitude}&z=15&output=embed`}
                />
              </section>
            )}
          </aside>
        </div>
      </div>
    </>
  )
}
