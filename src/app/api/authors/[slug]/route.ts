import { NextResponse } from 'next/server'
import { and, desc, eq } from 'drizzle-orm'
import { db, guestAuthor, guestPost } from '@/db'

// GET /api/authors/[slug]
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const author = await db.query.guestAuthor.findFirst({
    where: and(eq(guestAuthor.slug, slug), eq(guestAuthor.isActive, true)),
    with: {
      posts: {
        where: eq(guestPost.status, 'published'),
        columns: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          heroImageUrl: true,
          publishedAt: true,
        },
        orderBy: desc(guestPost.publishedAt),
      },
    },
  })

  if (!author) {
    return NextResponse.json({ error: 'Author not found' }, { status: 404 })
  }

  return NextResponse.json(author)
}
