/**
 * submission-slug.ts
 *
 * Generates Submission slugs in the format `MM-DD-YY-X` where X is a letter
 * (a, b, c, ...) incremented per slug on the same day. Used by:
 *   - The /submit/event form (server route)
 *   - The migration script that converts legacy SocialPosts
 *   - The future regional scan that submits Fox/Redlands/Riverside events
 *
 * The slug lives on the Submission row as a unique identifier and is the
 * way Johnny and Emma reference a submission in conversation ("for card
 * 08-19-26-a, would you look up the venue?").
 */

import { prisma } from './prisma'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Format a date as `MM-DD-YY` in UTC. Pinned to UTC to avoid timezone drift
 *  between server (UTC) and the user's local clock when two submitters on
 *  different sides of midnight both think they're on the same day. */
function dateSlug(d: Date): string {
  return `${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}-${String(d.getUTCFullYear()).slice(-2)}`
}

/** Returns the next available slug for the given date (UTC), starting at `a`
 *  and incrementing through the alphabet, then `aa`, `ab`, ... (unrealistic
 *  to need more than 26 in a day for an MVP community calendar). */
export async function nextSubmissionSlug(now: Date = new Date()): Promise<string> {
  const base = dateSlug(now)
  const existing = await prisma.submission.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  })
  const usedLetters = new Set<string>()
  for (const row of existing) {
    const suffix = row.slug.slice(base.length + 1) // after the dash
    if (suffix) usedLetters.add(suffix)
  }
  // Find the first letter not in use, a..z, then aa, ab, ...
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(97 + i) // a..z
    if (!usedLetters.has(letter)) return `${base}-${letter}`
  }
  // 26+ on the same day — rare, fall back to double letters.
  let n = 26
  while (true) {
    const a = Math.floor(n / 26)
    const b = n % 26
    const candidate = `${String.fromCharCode(97 + (a - 1))}${String.fromCharCode(97 + b)}`
    if (!usedLetters.has(candidate)) return `${base}-${candidate}`
    n++
  }
}
