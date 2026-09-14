// POST /api/businesses/upload-deal-image
//
// Owner or admin uploads a promotional image for a Business's deal.
// Returns { url }. Auth model mirrors the rest of the owner edit surface:
// the caller must be the Business.ownerId, or an ADMIN. Storage is Vercel
// Blob at `deals/<business-slug>/deal-image-<timestamp>.<ext>`.
//
// Top-level placement (not nested under [slug]) matches the canonical
// admin image upload pattern — see references/admin-image-upload-pattern-2026-08-16.md.

import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canManageBusiness } from '@/lib/business-mutations'

export const runtime = 'nodejs' // @vercel/blob requires Node.js

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const businessId = formData.get('businessId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }
    if (!businessId) {
      return NextResponse.json({ error: 'Missing businessId' }, { status: 400 })
    }

    const MAX_SIZE = 10 * 1024 * 1024 // 10MB
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    // Resolve the business + check the caller can manage it.
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, slug: true, ownerId: true },
    })
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }
    if (!canManageBusiness(
      { userId: session.user.id, role: session.user.role },
      business.ownerId,
    )) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const blobPath = `deals/${business.slug}/deal-image-${Date.now()}.${ext}`

    const blob = await put(blobPath, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: false,
    })

    return NextResponse.json({ url: blob.url })
  } catch (err) {
    console.error('[businesses/upload-deal-image] error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    )
  }
}