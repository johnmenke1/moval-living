import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Get all Fox + RMA pending submissions
const subs = await prisma.submission.findMany({
  where: {
    sourceAuthorHandle: { in: ['foxriverside', 'riverside.auditorium'] },
    status: 'PENDING',
  },
  select: { slug: true, title: true, sourceAuthorHandle: true, sourceUrl: true },
  orderBy: { startsAt: 'asc' },
})
console.log(`${subs.length} submissions to fetch promo images for`)

// Extract Ticketmaster event ID from sourceUrl
function getEventId(url) {
  const m = url.match(/event\/([A-Z0-9]+)/)
  return m ? m[1] : null
}

const todo = []
for (const s of subs) {
  const eventId = getEventId(s.sourceUrl)
  if (!eventId) {
    console.log(`  ${s.slug}: NO EVENT ID in ${s.sourceUrl}`)
    continue
  }
  todo.push({ ...s, eventId })
}
console.log(`${todo.length} with event IDs`)

// Save to a JSON file we'll iterate
import fs from 'node:fs'
fs.writeFileSync('./scripts/_promo-todo.json', JSON.stringify(todo, null, 2))
console.log('Saved to scripts/_promo-todo.json')

await prisma.$disconnect()
