import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/guest-posts — public: list published posts
export async function GET() {
  const posts = await prisma.guestPost.findMany({
    where: { status: 'published' },
    include: {
      author: {
        select: {
          id: true,
          displayName: true,
          slug: true,
          photoUrl: true,
          title: true,
          companyName: true,
        },
      },
    },
    orderBy: { publishedAt: 'desc' },
  })

  return NextResponse.json(posts)
}
