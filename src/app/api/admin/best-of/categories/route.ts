import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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
  const categories = await prisma.bestOfCategory.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { nominees: true, subCategories: true } },
      subCategories: {
        orderBy: { name: 'asc' },
        include: { _count: { select: { nominees: true } } },
      },
    },
  })

  return NextResponse.json(
    categories.map(c => ({
      ...c,
      nomineeCount: c._count.nominees,
      subCategoryCount: c._count.subCategories,
      subCategories: c.subCategories.map(sc => ({ ...sc, nomineeCount: sc._count.nominees })),
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
    const parent = await prisma.bestOfCategory.findUnique({ where: { id: parentCategoryId } })
    if (!parent) return NextResponse.json({ error: 'Parent category not found' }, { status: 400 })
    if (parent.parentCategoryId) return NextResponse.json({ error: 'Cannot nest more than one level deep' }, { status: 400 })
  }

  const existing = await prisma.bestOfCategory.findUnique({ where: { slug } })
  if (existing) {
    return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
  }

  const category = await prisma.bestOfCategory.create({
    data: {
      name,
      slug,
      description,
      icon,
      tagHints: tagHints ?? [],
      published: published ?? false,
      isSection: isSection ?? false,
      imageUrl: imageUrl ?? null,
      parentCategoryId: parentCategoryId ?? null,
    },
    include: {
      subCategories: {
        orderBy: { name: 'asc' },
        include: { _count: { select: { nominees: true } } },
      },
    },
  })

  return NextResponse.json({
    ...category,
    nomineeCount: 0,
    subCategoryCount: 0,
    subCategories: [],
  }, { status: 201 })
}
