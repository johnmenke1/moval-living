/**
 * POST /api/admin/events/generate-poster
 *
 * Generates a fal.ai hero image for a Submission and uploads to Vercel Blob.
 * Sets Submission.thumbnailUrl so the /events page can render the Event
 * with a consistent, on-brand image once admin approves.
 *
 * Auth: admin only. The cron and admin UI both call this endpoint.
 *
 * Body:
 *   { submissionId: string }    — generate for one submission
 *   { all: true }                — generate for every PENDING submission
 *                                 with no thumbnailUrl (cap at 10 per call
 *                                 to avoid runaway runs)
 *
 * Response:
 *   { processed: number, results: Array<{ submissionId, slug, status, thumbnailUrl?, error? }> }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'

// We use Recraft V3 instead of FLUX because FLUX diffusion models
// ignore "no text" instructions and add gibberish event posters to every
// image. Recraft supports explicit `negative_prompt` and reliably excludes
// text when told to. Trade-off: ~10s generation vs <1s, but the quality
// and prompt adherence is dramatically better.
const FAL_MODEL = 'fal-ai/recraft/v3/text-to-image'
const FAL_BASE = 'https://queue.fal.run'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 min — Vercel Pro limit; each fal image takes ~30s

/** Build the prompt for Recraft V3. We describe the scene in photographic
 *  terms and explicitly exclude text/words in the negative_prompt (Recraft
 *  actually respects negative prompts; FLUX doesn't). */
function buildPrompt(sub: { title: string; venueName: string | null; sourcePostCaption: string | null }): string {
  const title = sub.title || 'Community event'
  const venue = sub.venueName || 'local venue'

  // Pull scene keywords from the IG caption — gives us a more specific image
  let sceneKeywords = ''
  if (sub.sourcePostCaption) {
    const cleaned = sub.sourcePostCaption
      .slice(0, 200)
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[@#]\w+/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (cleaned.length > 20) sceneKeywords = cleaned.slice(0, 120)
  }

  return [
    `Photograph of a community event scene for a ${title}.`,
    sceneKeywords ? `Inspired by: ${sceneKeywords}.` : '',
    `Setting: ${venue}, Southern California.`,
    `Photographic style, editorial magazine quality, natural lighting.`,
    `Real people, candid moment, atmospheric scene.`,
    `No caption or title text in the image.`,
  ].filter(Boolean).join(' ')
}

/** Recraft's negative_prompt reliably excludes what we list here. */
function buildNegativePrompt(): string {
  return [
    'text, words, letters, typography, signage',
    'banners, posters with words, captions, titles, watermarks',
    'street signs, storefront text, t-shirts with text, logos with words',
    'gibberish writing, fake letters, blurry text, unreadable text',
    'event poster style, flyer, advertisement layout',
  ].join(', ')
}

/** Submit to fal queue, poll until done, return image URL. */
async function generateImage(prompt: string, apiKey: string): Promise<string> {
  const submitRes = await fetch(`${FAL_BASE}/${FAL_MODEL}`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      image_size: 'landscape_16_9',
      num_images: 1,
      negative_prompt: buildNegativePrompt(),
    }),
  })
  if (!submitRes.ok) {
    const body = await submitRes.text()
    throw new Error(`fal submit failed: ${submitRes.status} ${body.slice(0, 200)}`)
  }
  const { status_url, response_url } = await submitRes.json()

  // Poll status (GET works, POST returns 405)
  let attempts = 0
  let lastStatus: string | null = null
  while (attempts < 90) { // Recraft takes ~10s, allow 90s
    await new Promise((r) => setTimeout(r, 1000))
    attempts++
    const pollRes = await fetch(status_url, {
      headers: { Authorization: `Key ${apiKey}` },
    })
    if (!pollRes.ok) continue
    const pollText = await pollRes.text()
    if (!pollText) continue
    let poll: any
    try { poll = JSON.parse(pollText) } catch { continue }
    lastStatus = poll.status
    if (poll.status === 'COMPLETED') break
    if (poll.status === 'FAILED') throw new Error(`fal failed: ${JSON.stringify(poll)}`)
  }
  if (lastStatus !== 'COMPLETED') throw new Error(`fal poll timed out (last status: ${lastStatus})`)

  const resultRes = await fetch(response_url, {
    headers: { Authorization: `Key ${apiKey}` },
  })
  if (!resultRes.ok) throw new Error(`fal result fetch failed: ${resultRes.status}`)
  const result = await resultRes.json()
  // Recraft returns { images: [{ url }] } — same shape as FLUX
  const url = result.images?.[0]?.url
  if (!url) throw new Error('fal returned no image URL')
  return url
}

/** Download from fal, upload to Vercel Blob, return permanent URL. */
async function uploadToBlob(imageUrl: string, slug: string): Promise<string> {
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) throw new Error(`fal image download failed: ${imgRes.status}`)
  const buffer = Buffer.from(await imgRes.arrayBuffer())
  const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
  const ext = contentType.includes('png') ? 'png' : 'jpg'
  const blobPath = `events/${slug}/hero-${Date.now()}.${ext}`

  const blob = await put(blobPath, buffer, {
    access: 'public',
    contentType,
    // No explicit token — rely on OIDC auto-auth (Vercel injects BLOB_READ_WRITE_TOKEN)
  })
  return blob.url
}

/** Process one submission end-to-end. */
async function processOne(
  sub: { id: string; slug: string; title: string; venueName: string | null; sourcePostCaption: string | null },
  apiKey: string
): Promise<{ submissionId: string; slug: string; status: 'success' | 'error'; thumbnailUrl?: string; error?: string }> {
  try {
    const prompt = buildPrompt(sub)
    const falImageUrl = await generateImage(prompt, apiKey)
    const blobUrl = await uploadToBlob(falImageUrl, sub.slug)
    await prisma.submission.update({
      where: { id: sub.id },
      data: { thumbnailUrl: blobUrl, sourceCapturedAt: new Date() },
    })
    return { submissionId: sub.id, slug: sub.slug, status: 'success', thumbnailUrl: blobUrl }
  } catch (err) {
    return {
      submissionId: sub.id,
      slug: sub.slug,
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export async function POST(req: NextRequest) {
  // Two auth paths:
  //   1. Admin session (when admin clicks "Generate poster" in dashboard)
  //   2. Cron secret (when the daily cron triggers hero generation)
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
    return NextResponse.json(
      { error: 'FAL_KEY not configured on server' },
      { status: 500 }
    )
  }

  let body: any = {}
  try { body = await req.json() } catch { /* allow empty body for ?all=true */ }

  let subs: any[]
  if (body.submissionId) {
    const sub = await prisma.submission.findUnique({
      where: { id: body.submissionId },
      select: { id: true, slug: true, title: true, venueName: true, sourcePostCaption: true, sourcePlatform: true },
    })
    if (!sub) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    if (sub.sourcePlatform === 'OTHER') {
      return NextResponse.json(
        { error: 'Submission has no capturable source (OTHER platform)' },
        { status: 400 }
      )
    }
    subs = [sub]
  } else if (body.all) {
    // Cap at 10 to avoid runaway runs
    subs = await prisma.submission.findMany({
      where: {
        status: 'PENDING',
        thumbnailUrl: null,
        sourcePlatform: { in: ['INSTAGRAM', 'FACEBOOK'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, slug: true, title: true, venueName: true, sourcePostCaption: true, sourcePlatform: true },
    })
  } else {
    return NextResponse.json(
      { error: 'Provide either submissionId or all=true' },
      { status: 400 }
    )
  }

  const results = []
  for (const sub of subs) {
    results.push(await processOne(sub, apiKey))
  }

  return NextResponse.json({ processed: results.length, results })
}
