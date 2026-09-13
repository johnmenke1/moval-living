// Query PENDING submissions for daily prep categorization.
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const lines = readFileSync('./.env.local', 'utf8').split('\n')
const get = (k) => {
  const l = lines.find((x) => x.startsWith(k + '='))
  if (!l) return ''
  let v = l.split('=').slice(1).join('=').trim()
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
  return v
}
const DATABASE_URL = process.env.DATABASE_URL || get('DATABASE_URL')
if (!DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1) }

const pool = new Pool({ connectionString: DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const subs = await prisma.submission.findMany({
  where: { status: 'PENDING' },
  orderBy: { startsAt: 'asc' },
})

// Group: needs image vs already has one
const needsImage = subs.filter((s) => !s.thumbnailUrl)
const hasImage = subs.filter((s) => !!s.thumbnailUrl)

console.log(JSON.stringify({
  total: subs.length,
  needsImage: needsImage.length,
  hasImage: hasImage.length,
  needsImageSlugs: needsImage.map((s) => s.slug),
}, null, 2))

// Also: full list for categorization (save to a sibling json)
const full = []
for (const s of subs) {
  // duplicate check by sourceUrl
  const dupEvents = s.sourceUrl ? await prisma.event.findMany({
    where: { sourceUrl: s.sourceUrl },
    select: { id: true, slug: true, title: true, status: true },
  }) : []
  full.push({
    id: s.id,
    slug: s.slug,
    title: s.title,
    startsAt: s.startsAt,
    venueName: s.venueName,
    thumbnailUrl: s.thumbnailUrl,
    sourceUrl: s.sourceUrl,
    sourcePlatform: s.sourcePlatform,
    sourceAuthorHandle: s.sourceAuthorHandle,
    dupEvents,
  })
}
import { writeFileSync } from 'node:fs'
writeFileSync('./.working/daily-prep/pending.json', JSON.stringify(full, null, 2))
console.log('wrote .working/daily-prep/pending.json')

await prisma.$disconnect()