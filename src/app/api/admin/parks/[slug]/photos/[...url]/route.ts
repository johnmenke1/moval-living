import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { del } from '@vercel/blob'

export const dynamic = 'force-dynamic'

/**
 * DELETE /api/admin/parks/[slug]/photos?url=<blob-url>
 *
 * Removes a photo from the park's photoUrls, optionally clears the
 * hero if it was the deleted one, and deletes the underlying Vercel
 * Blob object.
 *
 * If the deleted photo was the hero and other photos remain, the next
 * remaining photo becomes the hero (so the card never goes blank).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { slug } = await params
  const url = req.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url param' }, { status: 400 })
  }

  const park = await prisma.park.findUnique({
    where: { slug },
    select: { photoUrls: true, heroPhotoUrl: true },
  })
  if (!park) {
    return NextResponse.json({ error: 'Park not found' }, { status: 404 })
  }
  if (!park.photoUrls.includes(url)) {
    return NextResponse.json({ error: 'URL not in photoUrls' }, { status: 404 })
  }

  const remaining = park.photoUrls.filter((u) => u !== url)
  const wasHero = park.heroPhotoUrl === url
  const newHero = wasHero ? (remaining[0] ?? null) : park.heroPhotoUrl

  const updated = await prisma.park.update({
    where: { slug },
    data: { photoUrls: remaining, heroPhotoUrl: newHero },
  })

  // Best-effort blob cleanup.
  try {
    await del(url)
  } catch (e) {
    console.warn(`[parks/photos/delete] failed to delete ${url}:`, e)
  }

  return NextResponse.json({ park: updated })
}
