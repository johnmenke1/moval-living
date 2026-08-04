import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/best-of/[categorySlug] — get one published category with nominees
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ categorySlug: string }> },
) {
  const { categorySlug } = await params

  const category = await prisma.bestOfCategory.findUnique({
    where: { slug: categorySlug, published: true },
    include: {
      nominees: {
        include: {
          business: {
            select: {
              id: true,
              slug: true,
              name: true,
              tagline: true,
              logo: true,
              googleRating: true,
              googleReviewCount: true,
              address: true,
              city: true,
              phone: true,
              website: true,
              tier: true,
            },
          },
        },
        orderBy: [{ winner: 'desc' }, { displayOrder: 'asc' }],
      },
    },
  })

  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  return NextResponse.json(category)
}
