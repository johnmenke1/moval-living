import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/best-of/[categorySlug] — get a category with its ranked entries
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ categorySlug: string }> }
) {
  try {
    const { categorySlug } = await params

    const category = await prisma.bestOfCategory.findUnique({
      where: { slug: categorySlug },
    })

    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Get all entries for this category, with business and score details
    const entries = await prisma.bestOfEntry.findMany({
      where: { categoryId: category.id },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            slug: true,
            tagline: true,
            logo: true,
            coverImage: true,
            address: true,
            city: true,
            phone: true,
            website: true,
            googleRating: true,
            googleReviewCount: true,
          },
        },
        scores: {
          orderBy: { factor: 'asc' },
        },
      },
      orderBy: { compositeScore: 'desc' },
    })

    // Assign ranks based on composite score order
    const rankedEntries = entries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
      yearsActive: entry.yearsActive,
    }))

    return NextResponse.json({
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        icon: category.icon,
        query: category.query,
      },
      entries: rankedEntries,
    })
  } catch (error) {
    console.error('BestOf category error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
