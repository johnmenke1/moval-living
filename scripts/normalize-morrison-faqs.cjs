/**
 * scripts/normalize-morrison-faqs.cjs
 *
 * After Flight Deck Bike Park was split out as its own record, Morrison
 * Park's faqsJson still contains 6 Flight Deck-specific Qs (Q1-Q5, Q8)
 * plus 2 generic Morrison Qs (Q6-Q7). The Flight Deck content
 * duplicates the new record. This normalizes Morrison's FAQ set back to
 * the universal templated set: location, amenities, ADA, hours (and
 * picnic-reservation if applicable).
 *
 * Idempotent: only writes when the existing faqsJson length matches the
 * pre-Flight-Deck canonical 8.
 */

const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

const MORRISON_SLUG = 'morrison-park'

// Universal templated FAQs (matches src/scripts/seed-park-faqs.mts's
// buildUniversalFaqs output). Morrison already has picnic shelter (#25
// is explicitly mentioned in the GIS Amenities string), so keep all 5
// universal questions.
const TEMPLATED_FAQS = [
  {
    q: 'Where is Morrison Park?',
    a: 'Morrison Park is at 26667 Dracaea Avenue, Moreno Valley, CA 92553. The 35-acre campus combines ballfields, picnic areas, and the Flight Deck Bike Park sub-area on its southern edge (separate facility, see the Flight Deck Bike Park listing).',
  },
  {
    q: 'What amenities does Morrison Park have?',
    a: "Morrison Park's amenities include: BBQ grills, parking lot, picnic tables, restrooms, security lighting, soccer fields, snack bar, lighted baseball/softball fields, picnic shelters, drinking fountains, and wheelchair-accessible facilities. The dedicated Flight Deck Bike Park on the south side adds a Velosolutions pump track, adaptive track, jump lines, and bicycle playground.",
  },
  {
    q: 'Is Morrison Park ADA-accessible?',
    a: "Yes — the restrooms and parking are ADA accessible, and picnic shelter #25 is ADA accessible. The Flight Deck Bike Park on the south side of the campus is also fully ADA-compliant with ramps at every intersection.",
  },
  {
    q: "What are Morrison Park's hours?",
    a: 'Daily, 7:00 AM to 10:00 PM.',
  },
  {
    q: 'Can I reserve a picnic shelter at Morrison Park?',
    a: "Yes — Morrison has at least one reservable picnic shelter (#25). Reserve through the City's ActiveNet system; links are posted on the park's detail page when available. For the Flight Deck Bike Park on the south side of the campus, no reservation is needed (drop-in, free admission).",
  },
]

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL not set')
    process.exit(1)
  }
  const pool = new Pool({ connectionString: url })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  const r = await prisma.park.findUnique({
    where: { slug: MORRISON_SLUG },
    select: { id: true, faqsJson: true },
  })
  if (!r) {
    console.error(`FATAL: ${MORRISON_SLUG} not found`)
    process.exit(2)
  }

  const existing = Array.isArray(r.faqsJson) ? r.faqsJson.length : 0
  // Only normalize if we're seeing the post-Flight-Deck 8-Q set.
  // Skip if already a templated 5-Q set.
  if (existing === 5) {
    console.log(`${MORRISON_SLUG} already has 5 templated Qs; nothing to do.`)
    process.exit(0)
  }
  if (existing !== 8) {
    console.log(
      `${MORRISON_SLUG} has ${existing} Qs — not the expected pre-split 8. Refusing to auto-normalize.`,
    )
    process.exit(3)
  }

  // The 6 Flight Deck questions are:
  //   - explicit "flight deck" mentions: Q1, Q2, Q4, Q5, Q8 (5 hits)
  //   - implicit Flight Deck content: Q3 (AGT path) + 2 generic Morrison Qs
  //     (Q6 hours, Q7 cost) — those are the 3 we keep / rewrite
  const flightDeckHints = (r.faqsJson || []).filter((f) => {
    const q = typeof f?.q === 'string' ? f.q.toLowerCase() : ''
    const a = typeof f?.a === 'string' ? f.a.toLowerCase() : ''
    return (
      q.includes('flight deck') ||
      q.includes('ambient glow') ||
      a.includes('velosolutions') ||
      a.includes('flight deck') ||
      a.includes('adaptive track')
    )
  })
  if (flightDeckHints.length < 5) {
    console.log(
      `Refusing: only ${flightDeckHints.length} Flight Deck Qs detected in ${MORRISON_SLUG}'s faqsJson. Refusing to strip non-Flight Deck content.`,
    )
    process.exit(4)
  }

  await prisma.park.update({
    where: { slug: MORRISON_SLUG },
    data: { faqsJson: TEMPLATED_FAQS },
  })
  console.log(
    `${MORRISON_SLUG} faqsJson normalized: 8 Qs (6 Flight Deck + 2 generic) → 5 universal templated Qs`,
  )
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('error:', err)
  process.exit(1)
})
