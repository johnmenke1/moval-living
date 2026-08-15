/**
 * scripts/backfill-submission-captures.mjs
 *
 * One-time backfill: for any existing PENDING Submission that has a sourceUrl
 * but no sourcePostCaption / sourceAuthorHandle, run the Playwright capture
 * and update the row. Run once after deploying the migration + new capture.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/backfill-submission-captures.mjs
 *   DATABASE_URL=... node scripts/backfill-submission-captures.mjs --dry-run
 */

import { chromium } from 'playwright'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const dryRun = process.argv.includes('--dry-run')

// Find all submissions that are missing caption + author
const subs = await prisma.submission.findMany({
  where: {
    OR: [
      { sourcePostCaption: null },
      { sourceAuthorHandle: null },
    ],
  },
  orderBy: { createdAt: 'desc' },
})

console.log(`Found ${subs.length} submissions needing capture backfill`)
if (subs.length === 0) {
  await prisma.$disconnect()
  process.exit(0)
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })

for (const s of subs) {
  // Skip non-IG/FB (OTHER platform — nothing to capture)
  if (s.sourcePlatform === 'OTHER') {
    console.log(`  ${s.slug} [OTHER] — skip`)
    continue
  }

  console.log(`  ${s.slug} ${s.title.slice(0,40)}...`)
  try {
    const ctx = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    })
    const page = await ctx.newPage()
    await page.goto(s.sourceUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForSelector('meta[property="og:title"]', { timeout: 5000 }).catch(() => null)

    const meta = await page.evaluate(() => {
      const get = (prop) => document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') ?? null
      return {
        ogTitle: get('og:title'),
        ogDescription: get('og:description'),
        ogImage: get('og:image'),
        ogUrl: get('og:url'),
      }
    })

    const handleMatch = meta.ogUrl?.match(/instagram\.com\/([^/]+)\//)
    const authorHandle = handleMatch ? handleMatch[1] : null
    const authorUrl = meta.ogUrl ?? null
    const thumbnailUrl = meta.ogImage ?? null

    let postCaption = null
    if (meta.ogTitle) {
      const igMatch = meta.ogTitle.match(/on Instagram:\s*"([\s\S]*)"\s*$/)
      if (igMatch) postCaption = igMatch[1]
      else postCaption = meta.ogTitle
    }
    if (!postCaption && meta.ogDescription) {
      const descMatch = meta.ogDescription.match(/:\s*"([\s\S]*)"\s*\.?\s*$/)
      postCaption = descMatch ? descMatch[1] : meta.ogDescription
    }

    console.log(`    handle: @${authorHandle ?? '(none)'}`)
    console.log(`    caption: ${postCaption?.slice(0, 60) ?? '(none)'}...`)
    console.log(`    thumb: ${thumbnailUrl ? 'yes' : 'no'}`)

    if (!dryRun) {
      await prisma.submission.update({
        where: { id: s.id },
        data: {
          sourceAuthorHandle: authorHandle,
          sourceAuthorUrl: authorUrl,
          sourceThumbnailUrl: thumbnailUrl,
          sourcePostCaption: postCaption,
          sourceCapturedAt: new Date(),
        },
      })
      console.log(`    ✓ updated`)
    }

    await ctx.close()
  } catch (err) {
    console.log(`    ERROR: ${err.message}`)
  }
}

await browser.close()
await prisma.$disconnect()
console.log('Done')
