import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { eq } from 'drizzle-orm'
import { db, socialPost, requireRow } from '@/db'
import { extractInstagramMedia } from '@/lib/instagram-media'

// POST /api/social-posts/[id]/extract — re-extract media from IG URL (admin only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if ((session.user as { role?: string }).role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const { id } = await params
  const post = await db.query.socialPost.findFirst({ where: eq(socialPost.id, id) })

  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  // Try extraction for Instagram posts
  if (post.platform !== 'INSTAGRAM') {
    return NextResponse.json({ error: 'Only Instagram posts are supported' }, { status: 400 })
  }

  const result = await extractInstagramMedia(post.postUrl)

  // Update DB with result if we got a URL
  if (result.mediaUrl) {
    requireRow(
      await db
        .update(socialPost)
        .set({
          mediaUrl: result.mediaUrl,
          ...(post.caption ? {} : { caption: result.caption }),
        })
        .where(eq(socialPost.id, id))
        .returning({ id: socialPost.id }),
      'Post not found'
    )
    const updated = await db.query.socialPost.findFirst({
      where: eq(socialPost.id, id),
      with: { business: { columns: { id: true, slug: true, name: true } } },
    })
    return NextResponse.json({ success: true, result, post: updated })
  }

  // Return raw result so we can see what went wrong
  return NextResponse.json({ success: false, result, postUrl: post.postUrl, platform: post.platform }, { status: 200 })
}
