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
})

// GET /api/admin/best-of/categories
export async function GET() {
  const categories = await prisma.bestOfCategory.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { nominees: true } },
    },
  })

  return NextResponse.json(
    categories.map(c => ({ ...c, nomineeCount: c._count.nominees })),
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

  const { name, slug, description, icon, tagHints, published } = parsed.data

  const existing = await prisma.bestOfCategory.findUnique({ where: { slug } })
  if (existing) {
    return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
  }

  const category = await prisma.bestOfCategory.create({
    data: { name, slug, description, icon, tagHints: tagHints ?? [], published: published ?? false },
  })

  return NextResponse.json(category, { status: 201 })
}
