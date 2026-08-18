/**
 * POST /api/admin/events/[id]/upload-hero
 *
 * Admin-only: manual image upload for an existing Event. Replaces the
 * Event.heroImageUrl with a URL served from Vercel Blob.
 *
 * Use this when:
 *   - The submitter's image is missing or low quality
 *   - The FAL-generated cover doesn't match the curator's editorial vision
 *   - The admin has a better promo image to use
 *
 * Body: multipart/form-data with a single `file` field. Accepts image/*
 * up to 8MB. Uploads to events/{slug}/hero-{timestamp}.{ext} in Vercel
 * Blob (same bucket as the FAL pipeline in regenerate-hero).
 *
 * Response: { eventId, slug, heroImageUrl }
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'
import { revalidatePath } from 'next/cache'

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])
const MAX_BYTES = 8 * 1024 * 1024 // 8MB

export const runtime = 'nodejs'
export const maxDuration = 60

function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    default:
      return 'bin'
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, slug: true },
  })
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing `file` field' }, { status: 400 })
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported image type: ${file.type}. Allowed: ${[...ALLOWED_MIME].join(', ')}` },
      { status: 400 },
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large: ${file.size} bytes (max ${MAX_BYTES})` },
      { status: 400 },
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = extFromMime(file.type)
  const blobPath = `events/${event.slug}/hero-${Date.now()}.${ext}`

  const blob = await put(blobPath, buffer, {
    access: 'public',
    contentType: file.type,
  })

  const updated = await prisma.event.update({
    where: { id },
    data: { heroImageUrl: blob.url },
    select: { id: true, slug: true, heroImageUrl: true },
  })

  revalidatePath('/events')

  return NextResponse.json({
    eventId: updated.id,
    slug: updated.slug,
    heroImageUrl: updated.heroImageUrl,
  })
}
