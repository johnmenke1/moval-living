import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { prisma } from '@/lib/prisma'
import { JsonLd } from '@/components/seo/JsonLd'
import { ArrowLeft, MapPin, Phone, Globe, Star, Clock, HelpCircle } from 'lucide-react'
import { AMENITIES } from '@/lib/park-amenities'
import type { ParkType } from '@/lib/parks'
import { typeLabel } from '@/lib/parks'

// Shape of Park.faqsJson (free-form, but constrained to {q, a} pairs)
// Stored as JSONB so we can add fields later (e.g. {q, a, category}) without
// a migration.
interface FaqEntry { q: string; a: string }

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

  // FAQs (when curated). Validate the stored JSON shape — admin UI can
  // produce any JSON, so we filter out anything that isn't a {q, a} pair
  // before rendering or emitting the schema block.
  const rawFaqs = Array.isArray(park.faqsJson) ? (park.faqsJson as unknown[]) : []
  const faqs: FaqEntry[] = rawFaqs
    .filter(
      (e): e is FaqEntry =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as Record<string, unknown>).q === 'string' &&
        typeof (e as Record<string, unknown>).a === 'string',
    )
    .map((e) => ({ q: e.q, a: e.a }))

  // Schema.org FAQPage — only emitted when FAQs exist. Google rich
  // results require every <mainEntity> to have a Question + acceptedAnswer.
  const faqSchema = faqs.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: {
            '@type': 'Answer',
            text: f.a,
          },
        })),
      }
    : null

  const heroSrc = park.heroPhotoUrl ?? park.photoUrls[0] ?? null
  const amenities = AMENITIES.filter((a) => park.amenities.includes(a.slug))

  return (
    <>
      <JsonLd schema={schema} />
      {faqSchema && <JsonLd schema={faqSchema} />}
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

            {/* FAQs (when curated). Each opens natively via <details>; the
                same array powers a Schema.org FAQPage block in the page
                <head> for SEO rich-result eligibility. */}
            {faqs.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <h2 className="font-bold text-text mb-3 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-primary" />
                  Frequently asked
                </h2>
                <div className="divide-y divide-slate-200">
                  {faqs.map((f, i) => (
                    <details
                      key={`faq-${i}-${f.q.slice(0, 16)}`}
                      className="group py-3"
                    >
                      <summary className="flex items-start justify-between gap-3 cursor-pointer list-none">
                        <span className="font-semibold text-text">{f.q}</span>
                        <span
                          aria-hidden
                          className="mt-0.5 text-text-secondary text-xl leading-none transition-transform group-open:rotate-45 select-none"
                        >
                          +
                        </span>
                      </summary>
                      <p className="mt-2 text-sm text-text-secondary whitespace-pre-line pl-1">
                        {f.a}
                      </p>
                    </details>
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
                {park.secondaryAddress && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${park.secondaryAddress}, ${park.city}, ${park.state}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary"
                    >
                      <span className="text-xs uppercase tracking-wider text-text-secondary font-semibold block mb-0.5">
                        Sub-area
                      </span>
                      {park.secondaryAddress}
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
