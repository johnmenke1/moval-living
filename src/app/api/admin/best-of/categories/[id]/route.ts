import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, bestOfCategory, requireRow } from '@/db'
import { z } from 'zod'

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

// PATCH /api/admin/best-of/categories/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const { parentCategoryId } = parsed.data

  // Prevent circular: can't set self as parent
  if (parentCategoryId === id) {
    return NextResponse.json({ error: 'Category cannot be its own parent' }, { status: 400 })
  }

  // Prevent nesting more than one level deep
  if (parentCategoryId) {
    const parent = await db.query.bestOfCategory.findFirst({ where: eq(bestOfCategory.id, parentCategoryId) })
    if (!parent) return NextResponse.json({ error: 'Parent category not found' }, { status: 400 })
    // Circular reference guard only — parent can be any category regardless of depth
  }

  const category = requireRow(
    await db
      .update(bestOfCategory)
      .set({ ...parsed.data, parentCategoryId: parentCategoryId ?? null })
      .where(eq(bestOfCategory.id, id))
      .returning(),
    'Category not found'
  )

  return NextResponse.json(category)
}

// DELETE /api/admin/best-of/categories/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  // Check for sub-categories — reassign them to top level (set parentCategoryId = null)
  await db
    .update(bestOfCategory)
    .set({ parentCategoryId: null })
    .where(eq(bestOfCategory.parentCategoryId, id))

  requireRow(
    await db.delete(bestOfCategory).where(eq(bestOfCategory.id, id)).returning({ id: bestOfCategory.id }),
    'Category not found'
  )
  return NextResponse.json({ success: true })
}
