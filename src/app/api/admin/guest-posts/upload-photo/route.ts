import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'

// POST /api/admin/guest-posts/upload-photo
// multipart: file, postId?
//   - Used by the OUTING post gallery rows.
//   - Each photo in a gallery can be uploaded independently (one POST per row).
// Path convention: guest-posts/{slug-or-'new'}/photo-{ts}-{rand4}.{ext}
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
    const postId = formData.get('postId') as string | null

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

    let pathSegment = 'new'
    if (postId) {
      const post = await prisma.guestPost.findUnique({
        where: { id: postId },
        select: { slug: true },
      })
      if (post) pathSegment = post.slug
    }

    const ext = (file.name.split('.').pop() || 'jpg')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
    // Random suffix because galleries can have multiple photos uploaded in
    // quick succession — without this they'd collide on the same timestamp.
    const rand = Math.random().toString(36).slice(2, 6)
    const blobPath = `guest-posts/${pathSegment}/photo-${Date.now()}-${rand}.${ext}`

    const blob = await put(blobPath, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: false,
      allowOverwrite: true,
    })

    return NextResponse.json({ url: blob.url })
  } catch (err) {
    console.error('[admin/guest-posts/upload-photo] error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}