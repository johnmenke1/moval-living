/**
 * scripts/generate-event-poster.mjs
 *
 * Generate a hero image for an Event Submission via FAL AI, then upload
 * to Vercel Blob and write the URL back to Submission.thumbnailUrl.
 *
 * The image is intentionally generated WITHOUT text — typography gets
 * overlaid by the React UI on /events so we control fonts/layout fully.
 *
 * Usage:
 *   DATABASE_URL=... BLOB_READ_WRITE_TOKEN=... FAL_KEY=... \
 *     node scripts/generate-event-poster.mjs --slug=08-15-26-c
 *   node scripts/generate-event-poster.mjs --all-pending   # backfill
 *   node scripts/generate-event-poster.mjs --dry-run --slug=08-15-26-c
 *
 * FAL_KEY is read from process.env or pulled from the Hermes home profile
 * .env if not set (so you don't have to export it for every run).
 */

import { readFileSync } from 'node:fs'
import { put } from '@vercel/blob'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// ── env ──────────────────────────────────────────────────────────────────
function loadEnv() {
  const lines = readFileSync('./.env.local', 'utf8').split('\n')
  const get = (k) => {
    const l = lines.find((x) => x.startsWith(k + '='))
    if (!l) return ''
    let v = l.split('=').slice(1).join('=').trim()
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    return v
  }
  return {
    DATABASE_URL: process.env.DATABASE_URL || get('DATABASE_URL'),
    BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN || get('BLOB_READ_WRITE_TOKEN'),
    FAL_KEY: process.env.FAL_KEY || get('FAL_KEY'),
  }
}
const env = loadEnv()
if (!env.DATABASE_URL) { console.error('DATABASE_URL required'); process.exit(1) }
if (!env.BLOB_READ_WRITE_TOKEN) { console.error('BLOB_READ_WRITE_TOKEN required'); process.exit(1) }
if (!env.FAL_KEY) { console.error('FAL_KEY required (set in .env.local or process env)'); process.exit(1) }

const pool = new Pool({ connectionString: env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ── flags ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const allPending = args.includes('--all-pending')
const slugArg = args.find((a) => a.startsWith('--slug='))?.slice(7)

// ── prompt builder ──────────────────────────────────────────────────────
/**
 * Build a FAL prompt from a Submission. The prompt asks for atmospheric
 * imagery with NO text — typography overlay happens in the React UI.
 *
 * Style is "editorial photo" so the result reads as a magazine-quality
 * image rather than a clipart / illustrated scene.
 */
function buildPrompt(sub) {
  const title = sub.title || 'Community event'
  const venue = sub.venueName || 'local venue'
  const caption = sub.sourcePostCaption || ''

  // Use caption keywords if available (more specific scene)
  let sceneKeywords = ''
  if (caption) {
    // Take first 200 chars of caption, strip URLs/hashtags/mentions
    const cleaned = caption
      .slice(0, 200)
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[@#]\w+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (cleaned.length > 20) {
      sceneKeywords = cleaned.slice(0, 120)
    }
  }

  const prompt = [
    `Editorial photo style event hero image for "${title}".`,
    sceneKeywords ? `Inspired by: ${sceneKeywords}.` : '',
    `Atmospheric setting near ${venue}, Moreno Valley California.`,
    `Moody cinematic lighting, modern composition, magazine quality.`,
    `Suitable for typography overlay on the right side.`,
    `NO TEXT, NO WORDS, NO LETTERS, NO TYPOGRAPHY anywhere in the image.`,
  ].filter(Boolean).join(' ')

  return prompt
}

// ── fal queue API ────────────────────────────────────────────────────────
const FAL_MODEL = 'fal-ai/flux-2/klein/9b'
const FAL_BASE = 'https://queue.fal.run'

async function generateImage(prompt) {
  // Submit
  const submitRes = await fetch(`${FAL_BASE}/${FAL_MODEL}`, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${env.FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      aspect_ratio: 'landscape',
      num_images: 1,
      output_format: 'jpeg',
    }),
  })
  if (!submitRes.ok) {
    const body = await submitRes.text()
    throw new Error(`fal submit failed: ${submitRes.status} ${body.slice(0, 200)}`)
  }
  const { request_id, status_url, response_url } = await submitRes.json()
  console.log(`  → fal request_id=${request_id}`)

  // Poll status (status_url accepts GET — POST returns 405)
  let attempts = 0
  const maxAttempts = 60 // ~60s
  let lastStatus = null
  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 1000))
    attempts++
    const pollRes = await fetch(status_url, {
      headers: { 'Authorization': `Key ${env.FAL_KEY}` },
    })
    if (!pollRes.ok) continue
    const pollText = await pollRes.text()
    if (!pollText) continue
    let poll
    try { poll = JSON.parse(pollText) } catch { continue }
    lastStatus = poll.status
    if (poll.status === 'COMPLETED') break
    if (poll.status === 'FAILED') {
      throw new Error(`fal generation failed: ${JSON.stringify(poll)}`)
    }
  }
  if (attempts >= maxAttempts) throw new Error(`fal poll timed out (last status: ${lastStatus})`)

  // Get result from response_url
  const resultRes = await fetch(response_url, {
    headers: { 'Authorization': `Key ${env.FAL_KEY}` },
  })
  if (!resultRes.ok) throw new Error(`fal result fetch failed: ${resultRes.status}`)
  const result = await resultRes.json()
  const imageUrl = result.images?.[0]?.url
  if (!imageUrl) throw new Error('fal returned no image URL')
  return imageUrl
}

// ── blob upload ──────────────────────────────────────────────────────────
async function uploadToBlob(imageUrl, slug) {
  // Download from fal
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`failed to download fal image: ${imgRes.status}`)
  const buffer = Buffer.from(await imgRes.arrayBuffer())
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
  const ext = contentType.includes('png') ? 'png' : 'jpg'
  const filename = `hero-${Date.now()}.${ext}`
  const blobPath = `events/${slug}/${filename}`

  const blob = await put(blobPath, buffer, {
    access: 'public',
    contentType,
    token: env.BLOB_READ_WRITE_TOKEN,
  })
  return blob.url
}

// ── main ─────────────────────────────────────────────────────────────────
async function processSubmission(sub) {
  console.log(`\n━━━ ${sub.slug} �━━`)
  console.log(`  title: ${sub.title}`)
  console.log(`  venue: ${sub.venueName || '(none)'}`)
  console.log(`  caption: ${sub.sourcePostCaption?.slice(0, 60) ?? '(none)'}...`)

  const prompt = buildPrompt(sub)
  console.log(`  prompt: ${prompt.slice(0, 80)}...`)

  if (dryRun) {
    console.log('  [dry-run] skipping fal + upload + db update')
    return { slug: sub.slug, status: 'dry-run' }
  }

  try {
    console.log('  → generating via fal...')
    const falImageUrl = await generateImage(prompt)
    console.log(`  → uploaded to fal: ${falImageUrl.slice(0, 80)}...`)

    console.log('  → uploading to Vercel Blob...')
    const blobUrl = await uploadToBlob(falImageUrl, sub.slug)
    console.log(`  → blob: ${blobUrl}`)

    await prisma.submission.update({
      where: { id: sub.id },
      data: {
        thumbnailUrl: blobUrl,
        sourceCapturedAt: new Date(),
      },
    })
    console.log('  ✓ updated Submission.thumbnailUrl')

    return { slug: sub.slug, status: 'success', thumbnailUrl: blobUrl }
  } catch (err) {
    console.error(`  ✗ error: ${err.message}`)
    return { slug: sub.slug, status: 'error', error: err.message }
  }
}

async function main() {
  let subs
  if (slugArg) {
    subs = [await prisma.submission.findUnique({ where: { slug: slugArg } })]
    if (!subs[0]) { console.error(`Submission ${slugArg} not found`); process.exit(1) }
  } else if (allPending) {
    subs = await prisma.submission.findMany({
      where: {
        status: 'PENDING',
        thumbnailUrl: null,
      },
      orderBy: { createdAt: 'desc' },
    })
  } else {
    console.error('Usage: --slug=XX-YY-ZZ-N OR --all-pending')
    process.exit(1)
  }

  console.log(`Processing ${subs.length} submission(s)`)
  const results = []
  for (const sub of subs) {
    results.push(await processSubmission(sub))
  }

  console.log('\n━━━ summary ━━━')
  for (const r of results) {
    console.log(`  ${r.slug}: ${r.status}${r.error ? ' — ' + r.error : ''}`)
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
