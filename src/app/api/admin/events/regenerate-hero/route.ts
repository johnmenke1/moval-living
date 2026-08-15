/**
 * POST /api/admin/events/regenerate-hero
 *
 * Admin-only: regenerate the hero image for an existing Event by re-running
 * the fal pipeline against the Event's venueName + city. Useful when:
 *  - The original generation had AI text artifacts
 *  - The admin wants a fresh take without un-approving the event
 *
 * Updates both:
 *  - Submission.thumbnailUrl (originating submission, if any)
 *  - Event.heroImageUrl
 *
 * Body:
 *   { eventId: string }    — regenerate one
 *
 * Response:
 *   { eventId, slug, status, heroImageUrl?, error? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'

const FAL_MODEL = 'fal-ai/recraft/v3/text-to-image'
const FAL_BASE = 'https://queue.fal.run'

const schema = z.object({
  eventId: z.string().min(1),
})

function buildPrompt(venueName: string, city: string | null): string {
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

function buildNegativePrompt(): string {
  return [
    'text, words, letters, typography, signage, alphabetic characters',
    'event title banners, magazine headers, newspaper mastheads',
    'watermark logos, sponsor badges, corner logos, branded overlays',
    'street signs, storefront signs, building signs with words, banners with words',
    'banners, posters with words, captions, titles, subtitles',
    't-shirts with text, hats with text, umbrellas with words',
    'gibberish writing, fake letters, blurry text, unreadable text',
    'event poster style, flyer, advertisement layout, sponsored content look',
  ].join(', ')
}

async function generateAndUpload(venueName: string, city: string | null, slug: string, apiKey: string): Promise<string> {
  const prompt = buildPrompt(venueName, city)

  // Submit
  const submitRes = await fetch(`${FAL_BASE}/${FAL_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      image_size: 'landscape_16_9',
      num_images: 1,
      negative_prompt: buildNegativePrompt(),
    }),
  })
  if (!submitRes.ok) throw new Error(`fal submit failed: ${submitRes.status}`)
  const { status_url, response_url } = await submitRes.json()

  // Poll
  let attempts = 0
  let last: string | null = null
  while (attempts < 90) {
    await new Promise((r) => setTimeout(r, 1000))
    attempts++
    const pollRes = await fetch(status_url, { headers: { Authorization: `Key ${apiKey}` } })
    const pollText = await pollRes.text()
    if (!pollText) continue
    try {
      const poll = JSON.parse(pollText)
      last = poll.status
      if (poll.status === 'COMPLETED') break
      if (poll.status === 'FAILED') throw new Error('fal generation failed')
    } catch {}
  }
  if (last !== 'COMPLETED') throw new Error(`fal poll timed out (last: ${last})`)

  const resultRes = await fetch(response_url, { headers: { Authorization: `Key ${apiKey}` } })
  const result = await resultRes.json()
  const imageUrl = result.images?.[0]?.url
  if (!imageUrl) throw new Error('fal returned no image URL')

  // Download + upload to Vercel Blob
  const imgRes = await fetch(imageUrl)
  const buffer = Buffer.from(await imgRes.arrayBuffer())
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
  const ext = contentType.includes('png') ? 'png' : 'jpg'
  const blobPath = `events/${slug}/hero-${Date.now()}.${ext}`

  const blob = await put(blobPath, buffer, { access: 'public', contentType })
  return blob.url
}

export async function POST(req: NextRequest) {
  // Two auth paths:
  //   1. Admin session (admin clicks "Regenerate" in dashboard)
  //   2. CRON_SECRET Bearer (the weekly review run regenerates all stale heroes)
  const cronSecret = process.env.CRON_SECRET
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/, '')
  const isCron = cronSecret && bearer === cronSecret

  if (!isCron) {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'FAL_KEY not configured on server' }, { status: 500 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Provide eventId' }, { status: 400 })

  const event = await prisma.event.findUnique({ where: { id: parsed.data.eventId } })
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  if (!event.venueName) {
    return NextResponse.json({ error: 'Event has no venueName — cannot generate hero' }, { status: 400 })
  }

  try {
    const heroImageUrl = await generateAndUpload(event.venueName, event.city, event.slug, apiKey)
    // Update Event
    await prisma.event.update({
      where: { id: event.id },
      data: { heroImageUrl },
    })
    // Also update originating Submission's thumbnail if it exists
    if (event.originatingSubmissionId) {
      await prisma.submission.update({
        where: { id: event.originatingSubmissionId },
        data: { thumbnailUrl: heroImageUrl },
      })
    }
    return NextResponse.json({ eventId: event.id, slug: event.slug, status: 'success', heroImageUrl })
  } catch (err) {
    return NextResponse.json({
      eventId: event.id,
      slug: event.slug,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
