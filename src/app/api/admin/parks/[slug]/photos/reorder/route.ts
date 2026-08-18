import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { z } from 'zod'
import { del } from '@vercel/blob'

export const dynamic = 'force-dynamic'

const reorderSchema = z.object({
  /** New ordering for photoUrls (full array, not a delta). */
  photoUrls: z.array(z.string().url()).max(50),
  /** URL to set as heroPhotoUrl. Must be one of the entries in photoUrls. */
  heroPhotoUrl: z.string().url().nullable(),
})

/**
 * POST /api/admin/parks/[slug]/photos/reorder
 *
 * Body: { photoUrls: string[], heroPhotoUrl: string | null }
 * - Rewrites the park's photoUrls in the requested order.
 * - Sets heroPhotoUrl to the chosen entry (or null to clear).
 * - Deletes blob objects that are no longer in the new array.
 *
 * The editor uses this whenever the admin drags a photo to a new
 * position or changes the hero.
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid fields', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  if (
    parsed.data.heroPhotoUrl !== null &&
    !parsed.data.photoUrls.includes(parsed.data.heroPhotoUrl)
  ) {
    return NextResponse.json(
      { error: 'heroPhotoUrl must be one of the entries in photoUrls' },
      { status: 400 },
    )
  }

  const existing = await prisma.park.findUnique({
    where: { slug },
    select: { photoUrls: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Park not found' }, { status: 404 })
  }

  // Find blobs that are being removed so we can garbage-collect them.
  const removed = existing.photoUrls.filter((u) => !parsed.data.photoUrls.includes(u))

  const updated = await prisma.park.update({
    where: { slug },
    data: {
      photoUrls: parsed.data.photoUrls,
      heroPhotoUrl: parsed.data.heroPhotoUrl,
    },
  })

  // Best-effort blob delete — failure here shouldn't block the response
  // (the admin's change already committed). Log and continue.
  await Promise.all(
    removed.map(async (url) => {
      try {
        await del(url)
      } catch (e) {
        console.warn(`[parks/photos/reorder] failed to delete ${url}:`, e)
      }
    }),
  )

  return NextResponse.json({ park: updated })
}
