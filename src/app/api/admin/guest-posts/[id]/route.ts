import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { z } from 'zod'

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

  const existing = await prisma.guestPost.findUnique({ where: { id } })
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

  const post = await prisma.guestPost.update({
    where: { id },
    data: updateData as Parameters<typeof prisma.guestPost.update>[0]['data'],
    include: {
      author: {
        select: { id: true, displayName: true, slug: true, photoUrl: true, title: true },
      },
    },
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

  const post = await prisma.guestPost.findUnique({ where: { id } })
  if (!post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  await prisma.guestPost.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
