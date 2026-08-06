import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/guest-posts/[slug]
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  const post = await prisma.guestPost.findUnique({
    where: { slug },
    include: {
      author: {
        select: {
          id: true,
          displayName: true,
          slug: true,
          photoUrl: true,
          title: true,
          bio: true,
          companyName: true,
          personalSiteUrl: true,
          linkedinUrl: true,
          twitterUrl: true,
          facebookUrl: true,
          instagramUrl: true,
        },
      },
    },
  })

  if (!post || post.status !== 'published') {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  return NextResponse.json(post)
}
