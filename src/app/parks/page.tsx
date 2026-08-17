import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { ParksClient } from './ParksClient'
import { JsonLd } from '@/components/seo/JsonLd'
import type { ParkSummary } from '@/lib/parks'

// Always pull fresh — the parks list changes when we re-run the City
// GIS layer refresh, and we want the page to reflect that on next visit.
export const dynamic = 'force-dynamic'

const BASE_URL = 'https://www.moval.living'

export const metadata: Metadata = {
  title: 'Parks & Recreation in Moreno Valley',
  description:
    'Every City of MoVal park on one interactive map — parks, trails, Cottonwood Golf Center, and recreation facilities. Filter by amenities, find parks near you, and explore user-submitted photos.',
  alternates: { canonical: `${BASE_URL}/parks` },
  keywords: [
    'Moreno Valley parks',
    'MoVal parks',
    'Cottonwood Golf Center',
    'Moreno Valley dog park',
    'skate park Moreno Valley',
    'Moreno Valley splash pad',
    'pump track Moreno Valley',
    'Moreno Valley recreation center',
    'parks near me Moreno Valley',
  ],
  openGraph: {
    type: 'website',
    url: `${BASE_URL}/parks`,
    title: 'Parks & Recreation in Moreno Valley — moval.living',
    description:
      'Every City of MoVal park on one interactive map — parks, trails, Cottonwood Golf Center, and recreation facilities. Filter by amenities, find parks near you, and explore user-submitted photos.',
    images: [
      {
        url: '/og-parks.jpg',
        width: 1200,
        height: 630,
        alt: 'Aerial view of Celebration Park splash pad in Moreno Valley',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Parks & Recreation in Moreno Valley',
    description:
      '36 parks, 1 golf course, 1 rec center — with a map, amenity filters, and "near me" distance.',
  },
}

async function getParks(): Promise<ParkSummary[]> {
  // Pull only the columns the public surface needs. Admin-edited fields
  // (description, blurb, hoursJson, photoUrls) are intentionally read
  // here so the card can show photos as soon as the capture pipeline
  // (step 9) writes them.
  const rows = await prisma.park.findMany({
    where: { isActive: true },
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      latitude: true,
      longitude: true,
      amenities: true,
      heroPhotoUrl: true,
      photoUrls: true,
      googleRating: true,
      googleReviewCount: true,
      featured: true,
    },
  })

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    type: r.type as ParkSummary['type'],
    address: r.address ?? null,
    latitude: r.latitude ?? null,
    longitude: r.longitude ?? null,
    amenities: r.amenities,
    heroPhotoUrl: r.heroPhotoUrl ?? null,
    photoUrls: r.photoUrls ?? [],
    googleRating: r.googleRating ?? null,
    googleReviewCount: r.googleReviewCount ?? null,
    featured: r.featured,
    googleMapUrl: null, // filled from a follow-up field if we add googlePlaceId lookups
    activeNetReservationUrl: null, // not stored on Park yet — leaves a hook for step 2 follow-up
  }))
}

export default async function ParksPage() {
  const parks = await getParks()

  // Schema.org ItemList of TouristAttraction (one per park) for SEO.
  // Lat/lng only renders the schema if we have it; parks without
  // coordinates get a sparse TouristAttraction entry that still
  // surfaces the name + address.
  const parksSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Moreno Valley Parks & Recreation',
    description:
      'City of Moreno Valley parks, trails, and recreation facilities',
    numberOfItems: parks.length,
    itemListElement: parks.map((p, idx) => {
      const item: Record<string, unknown> = {
        '@type': 'TouristAttraction',
        position: idx + 1,
        name: p.name,
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Moreno Valley',
          addressRegion: 'CA',
          addressCountry: 'US',
          ...(p.address ? { streetAddress: p.address } : {}),
        },
        url: `${BASE_URL}/parks#${p.slug}`,
      }
      if (p.latitude != null && p.longitude != null) {
        item.geo = {
          '@type': 'GeoCoordinates',
          latitude: p.latitude,
          longitude: p.longitude,
        }
      }
      return item
    }),
  }

  return (
    <>
      <JsonLd schema={parksSchema} />
      <ParksClient parks={parks} />
    </>
  )
}
