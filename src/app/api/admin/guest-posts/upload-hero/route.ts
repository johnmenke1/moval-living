import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'

// POST /api/admin/guest-posts/upload-hero
// multipart: file, postId?
//   - postId resolves the post's slug so the upload lands in a stable folder.
//   - omit postId for new posts; we fall back to 'new' and the slug gets
//     baked into the next upload after save.
// Path convention: guest-posts/{slug-or-'new'}/hero-{ts}.{ext}
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
    const blobPath = `guest-posts/${pathSegment}/hero-${Date.now()}.${ext}`

    const blob = await put(blobPath, file, {
      access: 'public',
      contentType: file.type,
      addRandomSuffix: false,
      allowOverwrite: true, // safety against same-ms retries; mirrors best-of/categories
    })

    return NextResponse.json({ url: blob.url })
  } catch (err) {
    console.error('[admin/guest-posts/upload-hero] error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 }
    )
  }
}