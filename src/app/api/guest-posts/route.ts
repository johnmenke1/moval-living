import { NextResponse } from 'next/server'
import { desc, eq } from 'drizzle-orm'
import { db, guestPost } from '@/db'

// GET /api/guest-posts — public: list published posts
export async function GET() {
  const posts = await db.query.guestPost.findMany({
    where: eq(guestPost.status, 'published'),
    with: {
      author: {
        columns: {
          id: true,
          displayName: true,
          slug: true,
          photoUrl: true,
          title: true,
          companyName: true,
        },
      },
    },
    orderBy: desc(guestPost.publishedAt),
  })

  return NextResponse.json(posts)
}
