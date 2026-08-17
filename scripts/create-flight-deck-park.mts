/**
 * scripts/create-flight-deck-park.mts
 *
 * One-shot structural change: makes the Flight Deck Bike Park its own
 * Park record distinct from Morrison Park.
 *
 *   Before:
 *     - Morrison Park:        26667 Dracaea Ave, sec=13460 Morrison St,
 *                              amenities include pump_track, 8 FAQs (3
 *                              of which are Flight Deck-specific)
 *     - Flight Deck Bike Park: does not exist as a Park record
 *
 *   After:
 *     - Morrison Park:        26667 Dracaea Ave, sec stays at
 *                              13460 Morrison St (forward pointer),
 *                              amenities lose pump_track (now lives on
 *                              the Flight Deck record), keeps its 5
 *                              generic FAQs (1-5)
 *     - Flight Deck Bike Park: 13460 Morrison St, geocoded 33.9254/-117.2002,
 *                              amenities [pump_track, bike_path, lights,
 *                              wheelchair_access, parking], its own
 *                              heroPhoto + photoUrls, 8 Flight Deck FAQs
 *
 *   Idempotent: re-runs do nothing destructive. If the Flight Deck record
 *   already exists, it exits without touching Morrison.
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const FLIGHT_DECK_SLUG = 'flight-deck-bike-park'
const FLIGHT_DECK = {
  slug: FLIGHT_DECK_SLUG,
  name: 'Flight Deck Bike Park',
  type: 'PARK' as const,
  address: '13460 Morrison Street',
  city: 'Moreno Valley',
  state: 'CA',
  zip: '92555',
  latitude: 33.9253612,
  longitude: -117.2001541,
  amenities: [
    'pump_track',
    'bike_path',
    'lights',
    'wheelchair_access',
    'parking',
  ],
  blurb:
    "Moreno Valley's Flight Deck Bike Park — a 25,000 sq ft Velosolutions asphalt pump track (the largest in Southern California), built on the south side of Morrison Park and ribbon-cut by the City December 5, 2025. Designed and built by American Ramp Company.",
  description:
    "The Flight Deck Bike Park sits on the southern edge of Morrison Park near the adjacent Fire Station at 13460 Morrison Street, Moreno Valley. Per the City of Moreno Valley's December 5, 2025 ribbon-cutting announcement, the Flight Deck is a world-class cycling destination inspired by the city's aviation heritage and designed to offer a welcoming experience for riders of all ages, abilities, and skill levels.\n\nThe marquee feature is a **25,000-square-foot Velosolutions asphalt pump track** — the largest of its kind in Southern California — built by American Ramp Company. The track layout mixes gentle rollers for beginners with larger features for advanced riders. Adjacent to the main pump track is the region's first **adaptive track** (designed for riders of all abilities) plus the first **asphalt jump lines** in Southern California and an **asphalt bicycle playground** for young riders.\n\nA 1,000-foot connecting path uses **Ambient Glow Technology** — sunlight-charged glow rocks that illuminate the trail after dark — the first use of this technology in Southern California, per the City.\n\nThe Flight Deck is free to ride and open during Morrison Park hours (daily, 7:00 AM – 10:00 PM). Free parking is available in the adjacent Morrison Park lot. Standard ramp rules apply: bikes, non-motorized scooters, skateboards, and rollerblades welcome; motorized vehicles are not permitted.",
  // No Flight Deck-specific photos captured yet (Morrison's 6 photos are
  // all ballfields/palm-trees/general vista — none show the pump track).
  // Set heroPhotoUrl to null and photoUrls to [] so the detail page
  // renders its "no photos" state honestly rather than mislabeling
  // ballfield imagery as Flight Deck content.
  heroPhotoUrl: null,
  photoUrls: [],
  googleRating: null as number | null,
  googleReviewCount: null as number | null,
  faqsJson: [
    {
      q: 'Where is the Flight Deck Bike Park?',
      a: "The Flight Deck is on the southern edge of Morrison Park, near the adjacent Fire Station at **13460 Morrison Street, Moreno Valley, CA 92555**. It is the dedicated bike / wheel-sports sub-area of the 35-acre Morrison campus, separate from the ballfields and picnic areas. Parking is available in the adjacent Morrison Park lot.",
    },
    {
      q: 'How big is the Flight Deck pump track?',
      a: 'The main pump track is **25,000 square feet of Velosolutions asphalt** — the largest Velosolutions pump track in Southern California. The track layout mixes gentle rollers for beginners with larger features for advanced riders, and the entire facility is designed to ride for all ages, abilities, and skill levels.',
    },
    {
      q: 'What is the Ambient Glow Technology path?',
      a: 'A 1,000-foot connecting path uses **Ambient Glow Technology** — sunlight-charged glow rocks that illuminate the trail after dark. Per the City, this is the first use of Ambient Glow Technology in Southern California.',
    },
    {
      q: "What's the design story behind the Flight Deck name?",
      a: "The City says the park was inspired by Moreno Valley's aviation heritage, and was designed to offer a welcoming cycling experience for riders of all ages, abilities, and skill levels. The Flight Deck was designed and built by American Ramp Company and ribbon-cut by the City of Moreno Valley on December 5, 2025.",
    },
    {
      q: 'Is the Flight Deck suitable for beginners?',
      a: 'Yes. The Flight Deck has a separate **adaptive track** (the region\'s first, designed for riders of all abilities), an **asphalt bicycle playground** for young riders, and a main 25,000 sq ft pump track that works for every skill level — beginners can ride the gentler rollers while advanced riders use the larger features.',
    },
    {
      q: 'What are the Flight Deck\'s hours?',
      a: 'The Flight Deck follows Morrison Park hours: **daily, 7:00 AM – 10:00 PM**. Free admission. The illuminated Ambient Glow Technology path stays visible after dark for evening rides.',
    },
    {
      q: 'Does the Flight Deck cost anything to enter?',
      a: 'No — admission is **free**. Parking is also free in the adjacent Morrison Park lot.',
    },
    {
      q: "What can I ride at the Flight Deck?",
      a: "Bikes (including adaptive cycles), standard non-motorized scooters, skateboards, and rollerblades are welcome. **Motorized bikes and motorized scooters are strictly prohibited** per the City's facility rules.",
    },
  ],
}

const MORRISON_SLUG = 'morrison-park'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('[create-flight-deck-park] DATABASE_URL not set')
    process.exit(1)
  }
  const pool = new Pool({ connectionString: url })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

  // Idempotency: bail early if the Flight Deck record already exists.
  const existing = await prisma.park.findUnique({
    where: { slug: FLIGHT_DECK_SLUG },
    select: { id: true, slug: true },
  })
  if (existing) {
    console.log(`[create-flight-deck-park] ${FLIGHT_DECK_SLUG} already exists (id=${existing.id}); nothing to do.`)
    console.log('   Run with --force to update Morrison Park amenities (idempotent for the rest).')
    process.exit(0)
  }

  // Validate prerequisites: Morrison must exist.
  const morrison = await prisma.park.findUnique({
    where: { slug: MORRISON_SLUG },
    select: {
      id: true,
      slug: true,
      name: true,
      amenities: true,
      faqsJson: true,
    },
  })
  if (!morrison) {
    console.error(`[create-flight-deck-park] FATAL: ${MORRISON_SLUG} not in DB — aborting.`)
    process.exit(2)
  }

  console.log(`[create-flight-deck-park] creating ${FLIGHT_DECK_SLUG}...`)
  const created = await prisma.park.create({ data: FLIGHT_DECK })
  console.log(`[create-flight-deck-park] created id=${created.id}`)

  // Update Morrison: remove pump_track (now lives on Flight Deck), keep
  // secondaryAddress as a cross-link, dedupe Flight Deck FAQs out of
  // Morrison's faqsJson (they live on the new record).
  const morrisonFaqsRaw = Array.isArray(morrison.faqsJson)
    ? (morrison.faqsJson as Array<{ q: string; a: string }>)
    : []
  const FLIGHT_DECK_Q_FRAGMENTS = [
    'flight deck',
    '13460 morrison',
    'adaptive-friendly',
    'is the flight deck',
  ]
  const morrisonFaqsClean = morrisonFaqsRaw.filter((f) => {
    const lc = f.q.toLowerCase()
    return !FLIGHT_DECK_Q_FRAGMENTS.some((frag) => lc.includes(frag))
  })
  const morrisonAmenitiesClean = morrison.amenities.filter(
    (a) => a !== 'pump_track',
  )
  console.log(
    `[create-flight-deck-park] morrison FAQ rows: ${morrisonFaqsRaw.length} → ${morrisonFaqsClean.length} (dropping Flight Deck Qs)`,
  )
  console.log(
    `[create-flight-deck-park] morrison amenities: ${morrison.amenities.length} → ${morrisonAmenitiesClean.length} (dropping pump_track)`,
  )

  const updated = await prisma.park.update({
    where: { slug: MORRISON_SLUG },
    data: {
      amenities: morrisonAmenitiesClean,
      faqsJson: morrisonFaqsClean,
      // secondaryAddress kept as a forward pointer to Flight Deck's address.
      // It still shows in the SUB-AREA block of the /parks/morrison-park page.
    },
  })
  console.log(`[create-flight-deck-park] morrison updated (id=${updated.id})`)

  console.log('[create-flight-deck-park] done')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[create-flight-deck-park] error:', err)
    process.exit(1)
  })
