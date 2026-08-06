import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/authors/[slug]
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const author = await prisma.guestAuthor.findUnique({
    where: { slug, isActive: true },
    include: {
      posts: {
        where: { status: 'published' },
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          heroImageUrl: true,
          publishedAt: true,
        },
        orderBy: { publishedAt: 'desc' },
      },
    },
  })

  if (!author) {
    return NextResponse.json({ error: 'Author not found' }, { status: 404 })
  }

  return NextResponse.json(author)
}
