/**
 * src/lib/parks.ts — Park domain logic.
 *
 * Pure helpers shared between the server entry, the client component,
 * and the admin editor when we add one later. No React, no Prisma
 * dependency — just data structures + math + a tiny slug normalizer.
 */

import { AMENITY_BY_SLUG, type AmenitySlug } from './park-amenities'

// ─── Types ────────────────────────────────────────────────────────────────

export type ParkType = 'PARK' | 'GOLF' | 'REC_CENTER'

export interface ParkSummary {
  id: string
  slug: string
  name: string
  type: ParkType
  address: string | null
  latitude: number | null
  longitude: number | null
  amenities: string[]
  heroPhotoUrl: string | null
  photoUrls: string[]
  googleRating: number | null
  googleReviewCount: number | null
  featured: boolean
  /** The City's GIS page, not Google's. Used as a "learn more" fallback
   *  for parks where we don't yet have a Google Maps deep link. */
  googleMapUrl: string | null
  activeNetReservationUrl: string | null
}

export interface UserLocation {
  /** Decimal degrees, never null once set. */
  latitude: number
  longitude: number
  /** Display label e.g. "Near you" or "Your location" (geocoding not done). */
  label: string
}

/** Distance result — miles + km, both for the user chip. */
export interface ParkDistance {
  miles: number
  kilometers: number
}

// ─── Geo math ─────────────────────────────────────────────────────────────

const EARTH_MILES = 3958.7613
const EARTH_KM = 6371.0088

/** Haversine great-circle distance between two lat/lng pairs. */
export function haversine(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): ParkDistance {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  const radians = 2 * Math.asin(Math.min(1, Math.sqrt(s)))

  return {
    miles: radians * EARTH_MILES,
    kilometers: radians * EARTH_KM,
  }
}
/** Haversine safe-narrow: returns null if either side is missing lat/lng. */
export function haversineOptional(
  a: { latitude: number | null; longitude: number | null },
  b: { latitude: number | null; longitude: number | null },
): ParkDistance | null {
  if (a.latitude == null || a.longitude == null) return null
  if (b.latitude == null || b.longitude == null) return null
  return haversine(
    { latitude: a.latitude, longitude: a.longitude },
    { latitude: b.latitude, longitude: b.longitude },
  )
}


/** Format a distance for the card pill. <0.1 mi → "nearby", <1 mi → in
 *  tenths, otherwise round to half miles. */
export function formatDistance(d: ParkDistance): string {
  if (d.miles < 0.1) return 'Nearby'
  if (d.miles < 1) return `${d.miles.toFixed(1)} mi`
  if (d.miles < 10) return `${d.miles.toFixed(1)} mi`
  return `${Math.round(d.miles)} mi`
}

// ─── Filtering ────────────────────────────────────────────────────────────

export interface ParkFilters {
  /** Multi-select amenity slugs. Park matches if ALL amenities are
   *  present (AND semantics — "show me parks WITH a pump_track AND a
   *  skate_park"). Users more often want facilities that have everything
   *  they're searching for than facilities that have at least one of N. */
  amenities: AmenitySlug[]
  type?: ParkType
  /** Free-text query, matched against name + address (case-insensitive). */
  query?: string
}

export function applyParkFilters(
  parks: ParkSummary[],
  filters: ParkFilters,
): ParkSummary[] {
  return parks.filter((p) => {
    if (filters.type && p.type !== filters.type) return false
    if (filters.amenities.length > 0) {
      for (const slug of filters.amenities) {
        if (!p.amenities.includes(slug)) return false
      }
    }
    if (filters.query) {
      const q = filters.query.toLowerCase()
      const hay = [
        p.name,
        p.address ?? '',
        ...p.amenities.map((a) => amenityLabel(a)),
      ]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
}

// ─── Label helpers (tunnel through to the amenity constant) ──────────────

export function amenityLabel(slug: string): string {
  return AMENITY_BY_SLUG[slug]?.label ?? slug.replace(/_/g, ' ')
}

/** Lucide icon name for a given amenity slug. Falls back to 'Tag'. */
export function amenityIcon(slug: string): string {
  const am = AMENITY_BY_SLUG[slug as AmenitySlug]
  return am?.icon ?? 'Tag'
}

// ─── Type labels ──────────────────────────────────────────────────────────

export const PARK_TYPE_LABELS: Record<ParkType, { singular: string; plural: string }> = {
  PARK: { singular: 'Park', plural: 'Parks' },
  GOLF: { singular: 'Golf Center', plural: 'Golf Centers' },
  REC_CENTER: { singular: 'Recreation Center', plural: 'Recreation Centers' },
}

export function typeLabel(t: ParkType): string {
  return PARK_TYPE_LABELS[t].singular
}

// ─── Sort w/ user location ───────────────────────────────────────────────

/** If the user shared a location, sort by distance ascending.
 *  Otherwise sort alphabetically by name. Stable secondary sort by
 *  type so all parks cluster together alphabetically within each type. */
export function sortParksForView(
  parks: ParkSummary[],
  userLocation: UserLocation | null,
): ParkSummary[] {
  if (!userLocation) {
    return [...parks].sort((a, b) => {
      if (a.type !== b.type) return a.type.localeCompare(b.type)
      return a.name.localeCompare(b.name)
    })
  }
  return [...parks]
      .map((p) => {
        if (p.latitude == null || p.longitude == null) {
          return { p, d: { miles: Infinity, kilometers: Infinity } }
        }
        return {
          p,
          d: haversine(
            { latitude: userLocation.latitude, longitude: userLocation.longitude },
            { latitude: p.latitude, longitude: p.longitude },
          ),
        }
      })
      .sort((a, b) => a.d.miles - b.d.miles)
      .map(({ p }) => p)
  }

/** Compute the geographic bounding box for parks on the map. Returns the
 *  default MoVal center if no parks have lat/lng. */
export function parksCenter(parks: ParkSummary[]): {
  lat: number
  lng: number
  zoom: number
} {
  const withCoords = parks.filter(
    (p) => p.latitude != null && p.longitude != null,
  ) as Array<ParkSummary & { latitude: number; longitude: number }>
  if (withCoords.length === 0) {
    // MoVal city center, default z (matches the user's geolocation in
    // the layout.tsx geo meta tags).
    return { lat: 33.9425, lng: -117.2297, zoom: 12 }
  }
  let minLat = withCoords[0].latitude
  let maxLat = withCoords[0].latitude
  let minLng = withCoords[0].longitude
  let maxLng = withCoords[0].longitude
  for (const p of withCoords) {
    if (p.latitude < minLat) minLat = p.latitude
    if (p.latitude > maxLat) maxLat = p.latitude
    if (p.longitude < minLng) minLng = p.longitude
    if (p.longitude > maxLng) maxLng = p.longitude
  }
  return {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
    // Approximate — Google Maps doesn't need a precise fit-bounds call.
    zoom: 12,
  }
}
