import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'

// POST /api/admin/best-of/categories/upload-image
// multipart: file, categoryId? (so existing rows land in a predictable path; new rows use 'new')
// Path convention: best-of/categories/{slug-or-id}/cover-{timestamp}.{ext}
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const categoryId = formData.get('categoryId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    const MAX_SIZE = 10 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    // Resolve a stable path segment. New categories don't have an id yet — fall
    // back to 'new' so the upload still lands somewhere sane.
    let pathSegment = 'new'
    if (categoryId) {
      const category = await prisma.bestOfCategory.findUnique({
        where: { id: categoryId },
        select: { slug: true },
      })
      if (category) pathSegment = category.slug
    }

    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
    const blobPath = `best-of/categories/${pathSegment}/cover-${Date.now()}.${ext}`

    const blob = await put(blobPath, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: false,
      allowOverwrite: true, // safety against same-ms retries; see vercel-blob-hero-upload-pattern
    })

    return NextResponse.json({ url: blob.url })
  } catch (err) {
    console.error('[admin/best-of/categories/upload-image] error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
