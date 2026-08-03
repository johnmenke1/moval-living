import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { canManageBusiness } from '@/lib/business-mutations'
import { put } from '@vercel/blob'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const businessId = formData.get('businessId') as string | null
    const type = formData.get('type') as string | null // 'logo' | 'cover' | 'photo'

    if (!file || !businessId || !type) {
      return NextResponse.json(
        { error: 'Missing file, businessId, or type' },
        { status: 400 }
      )
    }

    if (!['logo', 'cover', 'photo'].includes(type)) {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
    }

    // Max 10MB per image
    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    // Allowed MIME types
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    // Fetch business and verify ownership
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true, tier: true, photos: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const actor = { userId: session.user.id, role: session.user.role }
    if (!canManageBusiness(actor, business.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Tier-gated upload limits
    const isFeatured = business.tier === 'FEATURED'
    const isLogo = type === 'logo'
    const isCover = type === 'cover'
    const isPhoto = type === 'photo'

    if (isPhoto && !isFeatured) {
      return NextResponse.json(
        { error: 'Photo gallery is available for Featured businesses only' },
        { status: 403 }
      )
    }

    if (isPhoto && business.photos.length >= 10) {
      return NextResponse.json(
        { error: 'Photo limit reached (10 photos for Featured listings)' },
        { status: 403 }
      )
    }

    // Generate a stable blob filename: businesses/{businessId}/{type}/{filename}
    // Strip any path traversal attempts from the original filename
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const blobPath = `businesses/${businessId}/${type}/${safeName}`

    const blob = await put(blobPath, file.stream(), {
      access: 'public',
      contentType: file.type,
    })

    // Update the appropriate field on the Business record
    if (isLogo) {
      await prisma.business.update({
        where: { id: businessId },
        data: { logo: blob.url },
      })
    } else if (isCover) {
      await prisma.business.update({
        where: { id: businessId },
        data: { coverImage: blob.url },
      })
    } else if (isPhoto) {
      await prisma.business.update({
        where: { id: businessId },
        data: { photos: { push: blob.url } },
      })
    }

    return NextResponse.json({ url: blob.url, type })
  } catch (error) {
    console.error('[POST /api/upload]', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

// DELETE: remove a specific photo URL from the gallery
export async function DELETE(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const businessId = searchParams.get('businessId')
    const photoUrl = searchParams.get('url')

    if (!businessId || !photoUrl) {
      return NextResponse.json({ error: 'Missing businessId or url' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, ownerId: true, photos: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const actor = { userId: session.user.id, role: session.user.role }
    if (!canManageBusiness(actor, business.ownerId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Remove the photo URL from the array
    const updated = business.photos.filter((p) => p !== photoUrl)
    await prisma.business.update({
      where: { id: businessId },
      data: { photos: updated },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE /api/upload]', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
