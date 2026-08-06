import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { z } from 'zod'

const UpdateGuestAuthorSchema = z.object({
  displayName: z.string().min(1).optional(),
  title: z.string().optional().nullable(),
  bio: z.string().min(1).optional(),
  photoUrl: z.string().url().optional().nullable(),
  personalSiteUrl: z.string().url().optional().nullable(),
  companyName: z.string().optional().nullable(),
  companyUrl: z.string().url().optional().nullable(),
  linkedinUrl: z.string().url().optional().nullable(),
  twitterUrl: z.string().url().optional().nullable(),
  facebookUrl: z.string().url().optional().nullable(),
  instagramUrl: z.string().url().optional().nullable(),
  businessId: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
})

// PATCH /api/admin/guest-authors/[id]
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

  const parsed = UpdateGuestAuthorSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const author = await prisma.guestAuthor.findUnique({ where: { id } })
  if (!author) {
    return NextResponse.json({ error: 'Author not found' }, { status: 404 })
  }

  const updated = await prisma.guestAuthor.update({
    where: { id },
    data: parsed.data,
    include: {
      _count: { select: { posts: true } },
      business: { select: { id: true, name: true, slug: true, logo: true } },
    },
  })

  return NextResponse.json({ ...updated, postCount: updated._count.posts })
}

// DELETE /api/admin/guest-authors/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const author = await prisma.guestAuthor.findUnique({ where: { id } })
  if (!author) {
    return NextResponse.json({ error: 'Author not found' }, { status: 404 })
  }

  await prisma.guestAuthor.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
