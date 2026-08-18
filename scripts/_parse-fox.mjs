import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Parse the JSON-LD we just dumped from the browser
const raw = `PASTE_BROWSER_OUTPUT_HERE`  // we'll replace this

const events = []
const lines = raw.split('\n').filter(l => l.startsWith('{"@context"'))
for (const line of lines) {
  const ld = JSON.parse(line)
  events.push({
    title: ld.name,
    image: ld.image,
    startDate: ld.startDate,
    url: ld.url,
    venueName: ld.location?.name,
    street: ld.location?.address?.streetAddress,
    city: ld.location?.address?.addressLocality,
    region: ld.location?.address?.addressRegion,
    postal: ld.location?.address?.postalCode,
  })
}

// Filter out past events (today is 2026-08-15)
const now = new Date()
const upcoming = events.filter(e => new Date(e.startDate) >= now)
console.log(`Total: ${events.length}, Upcoming: ${upcoming.length}`)
for (const e of upcoming.slice(0, 5)) {
  console.log(`  ${e.startDate} | ${e.title} | @ ${e.venueName}`)
}
console.log(`...`)
for (const e of upcoming.slice(-3)) {
  console.log(`  ${e.startDate} | ${e.title} | @ ${e.venueName}`)
}

await prisma.$disconnect()
