import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, guestAuthor } from '@/db'
import { auth } from '@/auth'
import { z } from 'zod'
import { revalidateAuthorData } from '@/lib/revalidate'
import { getGuestAuthorAdmin } from '@/lib/guest-content'

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

  const author = await db.query.guestAuthor.findFirst({ where: eq(guestAuthor.id, id) })
  if (!author) {
    return NextResponse.json({ error: 'Author not found' }, { status: 404 })
  }

  await db.update(guestAuthor).set(parsed.data).where(eq(guestAuthor.id, id))

  return NextResponse.json(await getGuestAuthorAdmin(id))
}

// DELETE /api/admin/guest-authors/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const author = await db.query.guestAuthor.findFirst({ where: eq(guestAuthor.id, id) })
  if (!author) {
    return NextResponse.json({ error: 'Author not found' }, { status: 404 })
  }

  await db.delete(guestAuthor).where(eq(guestAuthor.id, id))
  // ISR cache bust — see src/lib/revalidate.ts for the path map.

  revalidateAuthorData()

  return NextResponse.json({ success: true })
}
