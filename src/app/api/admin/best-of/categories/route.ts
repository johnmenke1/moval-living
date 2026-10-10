import { NextRequest, NextResponse } from 'next/server'
import { asc, count, eq } from 'drizzle-orm'
import { db, bestOfCategory, bestOfNominee } from '@/db'
import { z } from 'zod'

const CreateCategorySchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  icon: z.string().optional(),
  tagHints: z.array(z.string()).optional(),
  published: z.boolean().optional(),
  isSection: z.boolean().optional(),
  imageUrl: z.string().optional(),
  parentCategoryId: z.string().optional().nullable(),
})

const UpdateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  tagHints: z.array(z.string()).optional(),
  published: z.boolean().optional(),
  isSection: z.boolean().optional(),
  imageUrl: z.string().optional(),
  parentCategoryId: z.string().optional().nullable(),
})

// GET /api/admin/best-of/categories
export async function GET() {
  const categories = await db.query.bestOfCategory.findMany({
    orderBy: asc(bestOfCategory.name),
    with: { subCategories: { orderBy: asc(bestOfCategory.name) } },
  })
  // Nominee counts per category in one grouped query (replaces Prisma's _count).
  const nomineeCounts = new Map(
    (
      await db
        .select({ categoryId: bestOfNominee.categoryId, n: count() })
        .from(bestOfNominee)
        .groupBy(bestOfNominee.categoryId)
    ).map((r) => [r.categoryId, r.n])
  )
  const nominees = (id: string) => nomineeCounts.get(id) ?? 0

  return NextResponse.json(
    categories.map(c => ({
      ...c,
      _count: { nominees: nominees(c.id), subCategories: c.subCategories.length },
      nomineeCount: nominees(c.id),
      subCategoryCount: c.subCategories.length,
      subCategories: c.subCategories.map(sc => ({
        ...sc,
        _count: { nominees: nominees(sc.id) },
        nomineeCount: nominees(sc.id),
      })),
    })),
  )
}

// POST /api/admin/best-of/categories
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const { name, slug, description, icon, tagHints, published, isSection, imageUrl, parentCategoryId } = parsed.data

  // Prevent circular parent
  if (parentCategoryId) {
    const parent = await db.query.bestOfCategory.findFirst({ where: eq(bestOfCategory.id, parentCategoryId) })
    if (!parent) return NextResponse.json({ error: 'Parent category not found' }, { status: 400 })
    // Circular reference guard only — parent can be any category regardless of depth
  }

  const existing = await db.query.bestOfCategory.findFirst({ where: eq(bestOfCategory.slug, slug) })
  if (existing) {
    return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
  }

  const [category] = await db
    .insert(bestOfCategory)
    .values({
      name,
      slug,
      description,
      icon,
      tagHints: tagHints ?? [],
      published: published ?? false,
      isSection: isSection ?? false,
      imageUrl: imageUrl ?? null,
      parentCategoryId: parentCategoryId ?? null,
    })
    .returning()

  return NextResponse.json({
    ...category,
    nomineeCount: 0,
    subCategoryCount: 0,
    subCategories: [],
  }, { status: 201 })
}
