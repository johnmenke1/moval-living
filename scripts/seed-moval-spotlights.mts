/**
 * Seed 30 City of Moreno Valley Business Spotlight videos into the
 * GuestPost table as `postType: 'SPOTLIGHT'` rows.
 *
 * - Idempotent: re-runnable. Matches on `slug` (derived from videoId).
 * - Source data: `prisma/data/moval-spotlights.json` (top 30 newest from
 *   the City of Moreno Valley's "Spotlight on Moreno Valley Business"
 *   YouTube playlist — pulled 2026-08-28).
 * - One shared `GuestAuthor` represents the City's Economic Development
 *   program. All 30 spotlights share that author.
 *
 * Run with:
 *   DATABASE_URL=<neon url> npx tsx scripts/seed-moval-spotlights.mts
 *
 * Re-run safety: existing rows are updated (status re-confirmed
 * `published`, excerpt refreshed), so you can re-pull the YouTube JSON
 * later and re-run to refresh dates/excerpts without duplicating rows.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ── Shared "City of Moreno Valley" GuestAuthor ──────────────────────────────
const CITY_AUTHOR = {
  slug: 'city-of-moreno-valley',
  displayName: 'City of Moreno Valley',
  title: 'Economic Development Department',
  bio:
    "The City of Moreno Valley's Economic Development Department promotes local businesses through the monthly \"Spotlight on Moreno Valley Business\" video program. Each 30-second spotlight features a different Moreno Valley business, highlighting the people and places that make the city special. moval.living is proud to curate the City's spotlight archive so it's easy to discover and share.",
  photoUrl: '',
  companyName: 'City of Moreno Valley',
  companyUrl: 'https://www.moval.org',
  linkedinUrl: '',
  twitterUrl: '',
  facebookUrl: 'https://www.facebook.com/cityofmorenovalley',
  instagramUrl: 'https://www.instagram.com/cityofmorenovalley',
  isActive: true,
} as const

// Helper — slugify videoId for stable URL:
// All YouTube IDs are 11 chars [A-Za-z0-9_-], URL-safe as-is.
const slugFor = (videoId: string) =>
  `city-spotlight-${videoId}`.toLowerCase()

function excerptFor(description: string, fallback: string): string {
  const t = (description || '').trim()
  if (!t) return fallback
  if (t.length <= 240) return t
  return t.slice(0, 237).trimEnd() + '...'
}

function bodyFor(entry: {
  title: string
  description: string
  youtubeUrl: string
  youtubeVideoId: string
}): string {
  // Minimal but real markdown body. The slug page renders YouTube at the
  // top, so the body just needs a short blurb + an external link.
  const { description, youtubeUrl, youtubeVideoId } = entry
  const desc = (description || '').trim()
  const descBlock = desc
    ? `\n${desc}\n`
    : `\nA 30-second spotlight from the City of Moreno Valley.\n`
  return [
    descBlock.trim(),
    '',
    `**[Watch on YouTube](${youtubeUrl})**`,
    '',
    `_Source: [City of Moreno Valley — Economic Development](https://www.moval.org). moval.living curates the City's spotlight archive to help local businesses reach more people._`,
    '',
    `<!-- youtube:${youtubeVideoId} -->`,
  ].join('\n')
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. Aborting.')
    process.exit(1)
  }

  const dataPath = join(
    process.cwd(),
    'prisma',
    'data',
    'moval-spotlights.json',
  )
  const raw = readFileSync(dataPath, 'utf-8')
  const entries = JSON.parse(raw) as Array<{
    youtubeVideoId: string
    title: string
    excerpt: string
    description: string
    heroImageUrl: string
    youtubeUrl: string
    uploadDate: string
  }>
  console.log(`📥 Loaded ${entries.length} entries from ${dataPath}`)

  // 1) Upsert the shared City author
  const cityAuthor = await prisma.guestAuthor.upsert({
    where: { slug: CITY_AUTHOR.slug },
    update: {
      displayName: CITY_AUTHOR.displayName,
      title: CITY_AUTHOR.title,
      bio: CITY_AUTHOR.bio,
      photoUrl: CITY_AUTHOR.photoUrl || null,
      companyName: CITY_AUTHOR.companyName,
      companyUrl: CITY_AUTHOR.companyUrl,
      facebookUrl: CITY_AUTHOR.facebookUrl,
      instagramUrl: CITY_AUTHOR.instagramUrl,
      isActive: CITY_AUTHOR.isActive,
    },
    create: {
      slug: CITY_AUTHOR.slug,
      displayName: CITY_AUTHOR.displayName,
      title: CITY_AUTHOR.title,
      bio: CITY_AUTHOR.bio,
      photoUrl: CITY_AUTHOR.photoUrl || null,
      companyName: CITY_AUTHOR.companyName,
      companyUrl: CITY_AUTHOR.companyUrl,
      facebookUrl: CITY_AUTHOR.facebookUrl,
      instagramUrl: CITY_AUTHOR.instagramUrl,
      isActive: CITY_AUTHOR.isActive,
    },
  })
  console.log(`✅ GuestAuthor: ${cityAuthor.displayName} (${cityAuthor.slug})`)

  // 2) Upsert each spotlight as a GuestPost
  let created = 0
  let updated = 0
  for (const e of entries) {
    const slug = slugFor(e.youtubeVideoId)
    const publishedAt = new Date(e.uploadDate)
    if (isNaN(publishedAt.getTime())) {
      console.warn(`⚠️  Skipping ${e.youtubeVideoId} — invalid uploadDate: ${e.uploadDate}`)
      continue
    }
    const excerpt = excerptFor(e.description, e.excerpt)
    const body = bodyFor(e)

    const existing = await prisma.guestPost.findUnique({ where: { slug } })

    await prisma.guestPost.upsert({
      where: { slug },
      update: {
        title: e.title,
        excerpt,
        body,
        heroImageUrl: e.heroImageUrl,
        youtubeVideoId: e.youtubeVideoId,
        status: 'published',
        publishedAt,
        postType: 'SPOTLIGHT',
        authorId: cityAuthor.id,
        // Keep meta* fields from the existing row if any.
      },
      create: {
        slug,
        postType: 'SPOTLIGHT',
        title: e.title,
        excerpt,
        body,
        heroImageUrl: e.heroImageUrl,
        youtubeVideoId: e.youtubeVideoId,
        status: 'published',
        publishedAt,
        authorId: cityAuthor.id,
      },
    })
    if (existing) updated++; else created++
  }

  console.log(`\n🎉 Done. Created ${created}, updated ${updated}.`)
  console.log(`   /spotlights should now show ${entries.length} city spotlights.`)
}

main()
  .catch((err) => {
    console.error('❌ Seed failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
