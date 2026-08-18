import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import fs from 'node:fs'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const subs = await prisma.submission.findMany({
  where: {
    sourceAuthorHandle: { in: ['foxriverside', 'riverside.auditorium'] },
    status: 'PENDING',
  },
  select: { slug: true, title: true, sourceAuthorHandle: true, sourceUrl: true, startsAt: true, thumbnailUrl: true },
  orderBy: { startsAt: 'asc' },
})

console.log(`${subs.length} events to process`)

// The JSON-LD images we extracted earlier
const imageMap = JSON.parse(fs.readFileSync('./scripts/_promo-images.json', 'utf-8'))

let matched = 0, unmatched = 0
for (const s of subs) {
  const m = s.sourceUrl.match(/event\/([A-Z0-9]+)/)
  if (!m) { unmatched++; continue }
  const eventId = m[1]
  const promoUrl = imageMap[eventId]
  if (promoUrl) {
    matched++
  } else {
    unmatched++
  }
}
console.log(`matched: ${matched}, unmatched: ${unmatched}`)

// Save the full list with current thumbnail + expected promo
const enriched = subs.map(s => {
  const m = s.sourceUrl.match(/event\/([A-Z0-9]+)/)
  const eventId = m ? m[1] : null
  return {
    slug: s.slug,
    title: s.title,
    handle: s.sourceAuthorHandle,
    startsAt: s.startsAt.toISOString(),
    eventId,
    currentThumbnail: s.thumbnailUrl,
    expectedPromoUrl: eventId ? imageMap[eventId] : null,
  }
})
fs.writeFileSync('./scripts/_all-promos.json', JSON.stringify(enriched, null, 2))
console.log('Wrote scripts/_all-promos.json')

await prisma.$disconnect()
