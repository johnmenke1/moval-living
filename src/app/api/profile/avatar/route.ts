import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'
import {
  AVATAR_MAX_BYTES,
  AVATAR_ALLOWED_TYPES,
  buildAvatarPath,
} from '@/app/dashboard/profile/profile-helpers'

export const runtime = 'nodejs'

/**
 * POST /api/profile/avatar
 *
 * Multipart form upload (field: "file"). Updates the current Owner's
 * `image` field with the new Vercel Blob URL. Mirrors the admin image
 * upload pattern at /api/admin/best-of/categories/upload-image but
 * with a smaller size cap (5MB instead of 10MB — avatars don't need
 * to be huge) and an auth gate instead of admin-only.
 *
 * Path convention: owners/{ownerId}/avatar-{timestamp}.{ext} so each
 * user's avatars live under their own prefix and can be cleaned up
 * by prefix if needed.
 *
 * Important: existing share cards + voter-feed snapshots keep the
 * OLD image (voterImageSnapshot was captured at vote-time). Only
 * future votes use the new avatar. This is the same model as
 * Google/Yelp and matches the documented behavior in
 * .hermes/plans/2026-08-22_best-of-registered-voters.md.
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return NextResponse.json(
      { error: 'File too large (max 5MB)' },
      { status: 400 },
    )
  }
  if (!AVATAR_ALLOWED_TYPES.includes(file.type as typeof AVATAR_ALLOWED_TYPES[number])) {
    return NextResponse.json(
      { error: 'Invalid file type. Use JPEG, PNG, WEBP, or GIF.' },
      { status: 400 },
    )
  }

  const blobPath = buildAvatarPath(session.user.id, file.type)
  const blob = await put(blobPath, file, {
    access: 'public',
    contentType: file.type,
    addRandomSuffix: false,
    allowOverwrite: true, // safe — same-user retrys in same ms land on the same URL
  })

  // Persist the new avatar URL on the Owner record
  await prisma.owner.update({
    where: { id: session.user.id },
    data: { image: blob.url },
    select: { id: true, image: true },
  })

  return NextResponse.json({ url: blob.url })
}
