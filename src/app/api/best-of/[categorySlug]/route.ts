import { NextResponse } from 'next/server'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db, bestOfCategory, bestOfNominee } from '@/db'

// GET /api/best-of/[categorySlug] — get one published category with nominees
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ categorySlug: string }> },
) {
  const { categorySlug } = await params

  const category = await db.query.bestOfCategory.findFirst({
    where: and(eq(bestOfCategory.slug, categorySlug), eq(bestOfCategory.published, true)),
    with: {
      nominees: {
        orderBy: [desc(bestOfNominee.winner), asc(bestOfNominee.displayOrder)],
        with: {
          business: {
            columns: {
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
      },
    },
  })

  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 })
  }

  return NextResponse.json(category)
}
