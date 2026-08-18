import { put } from '@vercel/blob'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const FAL_KEY = process.env.FAL_KEY
if (!FAL_KEY) { console.error('FAL_KEY required'); process.exit(1) }
const FAL_MODEL = 'fal-ai/recraft/v3/text-to-image'
const FAL_BASE = 'https://queue.fal.run'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Pull events that need new hero images
const events = await prisma.event.findMany({
  where: { heroImageUrl: null, venueName: { not: null } },
  orderBy: { startsAt: 'asc' },
})
console.log(`Found ${events.length} events needing hero images`)

function buildPrompt(venueName, city) {
  // Strip street address
  const cleanVenue = venueName.replace(/^\d+[^,]*,/, '').trim() || venueName
  const cityName = city || 'Southern California'
  return [
    `Editorial photograph of an outdoor community gathering.`,
    `Setting: ${cleanVenue}, ${cityName}.`,
    `Photographic style, magazine quality, golden hour natural lighting.`,
    `Real people, candid moment, atmospheric scene, journalistic photograph.`,
    `No text of any kind visible in the image.`,
    `Pure unedited photograph with no overlay or graphics.`,
  ].join(' ')
}

const NEGATIVE_PROMPT = [
  'text, words, letters, typography, signage, alphabetic characters',
  'event title banners, magazine headers, newspaper mastheads',
  'watermark logos, sponsor badges, corner logos, branded overlays',
  'street signs, storefront signs, building signs with words, banners with words',
  'banners, posters with words, captions, titles, subtitles',
  't-shirts with text, hats with text, umbrellas with words',
  'gibberish writing, fake letters, blurry text, unreadable text',
  'event poster style, flyer, advertisement layout, sponsored content look',
].join(', ')

async function generateAndUpload(venueName, city, slug) {
  const prompt = buildPrompt(venueName, city)
  console.log(`  prompt: ${prompt.slice(0, 80)}...`)

  // Submit
  const submitRes = await fetch(`${FAL_BASE}/${FAL_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_size: 'landscape_16_9',
      num_images: 1,
      negative_prompt: NEGATIVE_PROMPT,
    }),
  })
  if (!submitRes.ok) throw new Error(`submit failed: ${submitRes.status}`)
  const { status_url, response_url } = await submitRes.json()

  // Poll
  let attempts = 0, last = null
  while (attempts < 90) {
    await new Promise((r) => setTimeout(r, 1000))
    attempts++
    const r = await fetch(status_url, { headers: { Authorization: `Key ${FAL_KEY}` } })
    const t = await r.text()
    if (!t) continue
    try {
      const p = JSON.parse(t)
      last = p.status
      if (p.status === 'COMPLETED') break
      if (p.status === 'FAILED') throw new Error('fal failed')
    } catch {}
  }
  if (last !== 'COMPLETED') throw new Error('timeout')

  const resultRes = await fetch(response_url, { headers: { Authorization: `Key ${FAL_KEY}` } })
  const result = await resultRes.json()
  const imageUrl = result.images?.[0]?.url
  if (!imageUrl) throw new Error('no image url')

  // Download + upload to blob
  const imgRes = await fetch(imageUrl)
  const buffer = Buffer.from(await imgRes.arrayBuffer())
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
  const ext = contentType.includes('png') ? 'png' : 'jpg'
  const blobPath = `events/${slug}/hero-${Date.now()}.${ext}`

  const blob = await put(blobPath, buffer, {
    access: 'public',
    contentType,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
  return blob.url
}

for (const e of events) {
  console.log(`\n${e.slug}: ${e.title}`)
  if (!e.venueName) {
    console.log(`  no venueName, skipping`)
    continue
  }
  try {
    const url = await generateAndUpload(e.venueName, e.city, e.slug)
    await prisma.event.update({
      where: { id: e.id },
      data: { heroImageUrl: url },
    })
    console.log(`  ✓ ${url.slice(-40)}`)
  } catch (err) {
    console.log(`  ✗ ${err.message}`)
  }
}

await prisma.$disconnect()
