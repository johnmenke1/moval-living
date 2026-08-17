import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'

/**
 * POST /api/admin/parks/[slug]/photos
 *
 * Multipart upload. Field `file` carries the image. Stores at
 * `businesses/parks/{slug}/{ts}-{rand}.{ext}` in Vercel Blob.
 *
 * If the park has no heroPhotoUrl yet, the newly uploaded photo becomes
 * the hero automatically.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { slug } = await params

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
  }
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return NextResponse.json(
      { error: 'Unsupported file type (jpg, png, webp only)' },
      { status: 400 },
    )
  }

  const park = await prisma.park.findUnique({
    where: { slug },
    select: { photoUrls: true, heroPhotoUrl: true },
  })
  if (!park) {
    return NextResponse.json({ error: 'Park not found' }, { status: 404 })
  }

  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 8)
  const path = `businesses/parks/${slug}/${ts}-${rand}.${ext === 'jpeg' ? 'jpg' : ext}`

  const blob = await put(path, file, {
    access: 'public',
    addRandomSuffix: false,
    contentType: file.type || `image/${ext}`,
  })

  const newPhotoUrls = [...park.photoUrls, blob.url]
  const newHero = park.heroPhotoUrl ?? blob.url

  const updated = await prisma.park.update({
    where: { slug },
    data: { photoUrls: newPhotoUrls, heroPhotoUrl: newHero },
  })

  return NextResponse.json({ park: updated, url: blob.url })
}
