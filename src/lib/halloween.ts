/**
 * Halloween Home Decorating Contest - config + helpers.
 *
 * American Legion Post 574 x MoVal Living.
 *
 * EDIT THE CONFIG BLOCK BELOW to change dates, categories, prizes or
 * sponsors. Dates are absolute instants; the examples use Pacific time
 * (PDT = UTC-7 through Nov 1, 2026).
 */

// ---------------------------------------------------------------------------
// Config (placeholders - confirm with Post 574)
// ---------------------------------------------------------------------------

export const HALLOWEEN_CONFIG = {
  title: 'MoVal Haunted Homes',
  year: 2026,
  host: 'American Legion Post 574',
  // Entries accepted from ... to ... (PDT = UTC-7 through Nov 1, 2026).
  // Open as of Oct 11; both windows close end of day Oct 24.
  submissionsOpen: '2026-10-11T00:00:00-07:00',
  submissionsClose: '2026-10-24T23:59:59-07:00',
  // Public voting window
  votingOpen: '2026-10-11T00:00:00-07:00',
  votingClose: '2026-10-24T23:59:59-07:00',
  // Winners announced
  winnersAnnounced: '2026-11-01T12:00:00-07:00',
  // Optional categories entrants pick from. Public voting is one People's
  // Choice vote per home; categories are for the judges/leaderboard filters.
  categories: [
    'Spookiest',
    'Most Creative',
    'Best Kid-Friendly',
    'Best Lights & Animation',
    'Best Use of a Theme',
  ],
  // Top-3 winners all receive a custom yard sign naming their placement.
  prizes: [
    { place: '1st Place', prize: 'Yard sign naming 1st Place' },
    { place: '2nd Place', prize: 'Yard sign naming 2nd Place' },
    { place: '3rd Place', prize: 'Yard sign naming 3rd Place' },
  ] as { place: string; prize: string }[],
  // Sponsors shown on the page (name + optional link). Great cross-promo spot.
  sponsors: [] as { name: string; url?: string }[],
  // Photos
  maxPhotos: 3,
  maxPhotoBytes: 10 * 1024 * 1024,
  // Registration perk: the first N entries receive a free competition
  // participation sign. Display-only (the actual limit is enforced by the
  // enter flow once the cap is hit).
  participationSignLimit: 25,
}

export type ContestPhase = 'upcoming' | 'open' | 'voting' | 'closed'

export interface ContestState {
  submissionsOpen: boolean
  votingOpen: boolean
  phase: ContestPhase
}

export function getContestState(now: Date = new Date()): ContestState {
  const t = now.getTime()
  const subOpen = Date.parse(HALLOWEEN_CONFIG.submissionsOpen)
  const subClose = Date.parse(HALLOWEEN_CONFIG.submissionsClose)
  const voteOpen = Date.parse(HALLOWEEN_CONFIG.votingOpen)
  const voteClose = Date.parse(HALLOWEEN_CONFIG.votingClose)
  const submissionsOpen = t >= subOpen && t <= subClose
  const votingOpen = t >= voteOpen && t <= voteClose
  let phase: ContestPhase
  if (t < subOpen) phase = 'upcoming'
  else if (votingOpen) phase = 'voting'
  else if (submissionsOpen) phase = 'open'
  else phase = 'closed'
  return { submissionsOpen, votingOpen, phase }
}

// ---------------------------------------------------------------------------
// Address + location helpers
// ---------------------------------------------------------------------------

/** Normalised key used to stop the same house being entered twice. */
export function addressKey(street: string, zip?: string | null): string {
  const s = street
    .toLowerCase()
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\bcourt\b/g, 'ct')
    .replace(/\blane\b/g, 'ln')
    .replace(/\bcircle\b/g, 'cir')
    .replace(/\bplace\b/g, 'pl')
    .replace(/[^a-z0-9]/g, '')
  return `${s}|${(zip ?? '').replace(/\D/g, '').slice(0, 5)}`
}

/** "1234 Elm St" -> "Elm St" */
export function streetNameOnly(street: string): string {
  return street.replace(/^\s*\d+[A-Za-z]?\s+/, '').trim() || street.trim()
}

export interface PublicLocation {
  publicLatitude: number
  publicLongitude: number
  locationLabel: string
}

/**
 * What the public map is allowed to see.
 * - showExactAddress: exact pin + full street address.
 * - otherwise: coordinates rounded to ~100 m and a "Near <street>" label.
 */
export function publicLocationFor(
  lat: number,
  lng: number,
  street: string,
  showExactAddress: boolean,
): PublicLocation {
  if (showExactAddress) {
    return { publicLatitude: lat, publicLongitude: lng, locationLabel: street.trim() }
  }
  const round = (n: number) => Math.round(n * 1000) / 1000
  return {
    publicLatitude: round(lat),
    publicLongitude: round(lng),
    locationLabel: `Near ${streetNameOnly(street)}`,
  }
}

// Rough bounding box for Moreno Valley and immediate surroundings.
const MV_BOUNDS = { south: 33.80, north: 34.04, west: -117.40, east: -117.02 }

export function insideMorenoValleyArea(lat: number, lng: number): boolean {
  return lat >= MV_BOUNDS.south && lat <= MV_BOUNDS.north && lng >= MV_BOUNDS.west && lng <= MV_BOUNDS.east
}

export interface GeocodeResult {
  lat: number
  lng: number
  formatted: string
}

/** Server-side Google Geocoding. Returns null on any failure (admin can fix coords). */
export async function geocodeAddress(
  street: string,
  city: string,
  zip?: string | null,
): Promise<GeocodeResult | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!key) return null
  const address = `${street}, ${city}, CA${zip ? ` ${zip}` : ''}`
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}` +
    `&region=us&bounds=${MV_BOUNDS.south},${MV_BOUNDS.west}|${MV_BOUNDS.north},${MV_BOUNDS.east}` +
    `&key=${encodeURIComponent(key)}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = (await res.json()) as {
      status: string
      results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[]
    }
    const r = data.status === 'OK' ? data.results?.[0] : undefined
    if (!r) return null
    return { lat: r.geometry.location.lat, lng: r.geometry.location.lng, formatted: r.formatted_address }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Hashing + signed device cookie (WebCrypto - works on Node and Workers)
// ---------------------------------------------------------------------------

export const DEVICE_COOKIE = 'mv_hv'

function secret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'dev-only-halloween-secret'
}

const enc = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function hmacHex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)))
}

/** Keyed hash of an IP address - raw IPs are never stored. */
export async function hashIp(ip: string): Promise<string> {
  return (await hmacHex(`halloween-ip:${ip}`)).slice(0, 40)
}

export async function mintDeviceCookie(): Promise<{ id: string; value: string }> {
  const id = crypto.randomUUID().replace(/-/g, '')
  const sig = (await hmacHex(`halloween-device:${id}`)).slice(0, 32)
  return { id, value: `${id}.${sig}` }
}

/** Returns the device id when the cookie value carries a valid signature. */
export async function readDeviceCookie(value: string | undefined | null): Promise<string | null> {
  if (!value) return null
  const [id, sig] = value.split('.')
  if (!id || !sig || id.length !== 32) return null
  const expected = (await hmacHex(`halloween-device:${id}`)).slice(0, 32)
  if (expected.length !== sig.length) return null
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0 ? id : null
}

/**
 * Caller IP. On Cloudflare, `cf-connecting-ip` is set by the edge and cannot be
 * spoofed by the client, so it is preferred; the others are dev/proxy fallbacks.
 */
export function clientIp(headers: Headers): string {
  return (
    headers.get('cf-connecting-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  )
}
