// scripts/lib/parse-chamber-address.mjs
// Parse multi-line Chamber address strings into structured fields.
// Handles the GrowthZone CMS format observed at movalchamber.org on 2026-08-09:
//   "14941 Riverside Drive March ARB CA 92518"
//   "PO Box 10130 Moreno Valley CA 92552"
//   "12980Day St. Suite 101 Moreno Valley CA 92553-5253"
//   "141 E. Alessandro Bd. Suite 10-A Riverside CA 92508"
//   "29995 Technology Dr STE 306 Murrieta CA 92563"
//
// US-only. State is 2-letter abbreviation. Zip is 5 or 9 digits.
// Full state names ("California") are intentionally out-of-scope — flagged separately.
//
// Algorithm: anchor on the state abbreviation (+ zip) at the end. The city is the last
// 1-3 tokens BEFORE the state. Prefer the longest 1-3-token group that matches a known
// city in our region. Fall back to the longest plausible split if no known city matches.

const KNOWN_CITIES = new Set([
  // MoVal-area — verified in our DB
  'moreno valley',
  // Riverside County neighbors — observed in the Chamber directory
  'riverside', 'murrieta', 'ontario', 'mission viejo', 'henderson',
  'corona', 'temecula', 'perris', 'redlands', 'san bernardino',
  'yucaipa', 'calimesa', 'beaumont', 'banning', 'hemet',
  'menifee', 'lake elsinore', 'wildomar', 'winchester',
  'sun city', 'canyon lake', 'eastvale', 'norco', 'jurupa valley',
  'rialto', 'fontana', 'colton', 'grand terrace', 'loma linda',
  'highland', 'san jacinto', 'indio', 'coachella',
  'indian wells', 'palm desert', 'palm springs', 'rancho mirage',
  'la quinta', 'desert hot springs', 'cathedral city',
  // Tricky: "March ARB" (Air Reserve Base) — appears in our probe data
  'march arb', 'march',
])

export function parseChamberAddress(raw) {
  if (typeof raw !== 'string') return null
  const cleaned = raw.replace(/\s+/g, ' ').trim()
  // State + zip — anchored at end. 2-letter abbreviation only.
  const stateMatch = cleaned.match(/ (CA|NV|AZ|OR) (\d{5}(?:-\d{4})?)$/i)
  if (!stateMatch) return null
  const state = stateMatch[1].toUpperCase()
  const zip = stateMatch[2]
  const before = cleaned.slice(0, stateMatch.index).trim()
  // City is the last 1-3 tokens before the state. Prefer the LONGEST city match
  // that's in the known-cities set. Fall back to the longest 1-3 token group.
  const tokens = before.split(/\s+/)
  if (tokens.length < 2) return null
  let city = null, street = null
  for (let k = Math.min(3, tokens.length - 1); k >= 1; k--) {
    const candidate = tokens.slice(tokens.length - k).join(' ')
    const prefix = tokens.slice(0, tokens.length - k).join(' ')
    if (prefix.length > 0) {
      const inSet = KNOWN_CITIES.has(candidate.toLowerCase())
      if (inSet) {
        city = candidate
        street = prefix
        break
      }
      if (!city) {
        city = candidate
        street = prefix
      }
    }
  }
  if (!city) return null
  return { street, city, state, zip }
}

export function normalizePhone(raw) {
  if (typeof raw !== 'string') return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 13) return null
  // Strip leading 1 from US 11-digit numbers: 1-844-213-9549 → 8442139549
  const stripped = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return stripped
}

export function isMorenoValleyAddress({ city, zip } = {}) {
  if (!city || !zip) return false
  if (city.toLowerCase() === 'moreno valley') return true
  if (/^9255\d/.test(zip)) return true
  return false
}

export function isPOBox(street) {
  if (!street) return false
  return /\bp\.?o\.?\s*box\b/i.test(street)
}

// Tiny Levenshtein for name similarity scoring. Not a hot path.
export function levenshtein(a, b) {
  if (a === b) return 0
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = a[i-1] === b[j-1] ? 0 : 1
      dp[i][j] = Math.min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + c)
    }
  }
  return dp[m][n]
}

export function normalizeName(s) {
  return s.toLowerCase()
    .replace(/\b(inc|llc|corp|co|dba|the|of|and)\b/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
