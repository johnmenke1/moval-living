import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, guestPost, requireRow } from '@/db'
import { auth } from '@/auth'
import { z } from 'zod'
import { revalidatePostData } from '@/lib/revalidate'

const UpdateGuestPostSchema = z.object({
  title: z.string().min(1).optional(),
  excerpt: z.string().optional(),
  body: z.string().min(1).optional(),
  heroImageUrl: z.string().url().optional().nullable(),
  authorId: z.string().optional(),
  editorNotes: z.string().optional().nullable(),
  metaTitle: z.string().optional().nullable(),
  metaDescription: z.string().optional().nullable(),
  status: z.enum(['draft', 'submitted', 'in_review', 'scheduled', 'published', 'rejected']).optional(),
  scheduledFor: z.string().datetime().optional().nullable(),
  rejectionReason: z.string().optional().nullable(),
})

// PATCH /api/admin/guest-posts/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateGuestPostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const existing = await db.query.guestPost.findFirst({ where: eq(guestPost.id, id) })
  if (!existing) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const updateData: Record<string, unknown> = { ...parsed.data }

  // Auto-set publishedAt when status transitions to published
  if (parsed.data.status === 'published' && existing.status !== 'published') {
    updateData.publishedAt = new Date()
  }

  // Auto-set submittedAt when status transitions to submitted/in_review/scheduled
  if (
    ['submitted', 'in_review', 'scheduled'].includes(parsed.data.status ?? '') &&
    !existing.submittedAt
  ) {
    updateData.submittedAt = new Date()
  }

  // Parse scheduledFor if provided
  if (parsed.data.scheduledFor) {
    updateData.scheduledFor = new Date(parsed.data.scheduledFor as string)
  }

  requireRow(
    await db
      .update(guestPost)
      .set(updateData as Partial<typeof guestPost.$inferInsert>)
      .where(eq(guestPost.id, id))
      .returning({ id: guestPost.id }),
    'Post not found'
  )
  const post = await db.query.guestPost.findFirst({
    where: eq(guestPost.id, id),
    with: { author: { columns: { id: true, displayName: true, slug: true, photoUrl: true, title: true } } },
  })

  return NextResponse.json(post)
}

// DELETE /api/admin/guest-posts/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const post = await db.query.guestPost.findFirst({ where: eq(guestPost.id, id) })
  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  await db.delete(guestPost).where(eq(guestPost.id, id))
  // ISR cache bust — see src/lib/revalidate.ts for the path map.

  revalidatePostData()

  return NextResponse.json({ success: true })
}
