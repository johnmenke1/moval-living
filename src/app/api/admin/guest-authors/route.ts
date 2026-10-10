import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db, guestAuthor } from '@/db'
import { auth } from '@/auth'
import { z } from 'zod'
import { revalidateAuthorData } from '@/lib/revalidate'
import { getGuestAuthorAdmin, listGuestAuthorsAdmin } from '@/lib/guest-content'

const CreateGuestAuthorSchema = z.object({
  displayName: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().optional(),
  bio: z.string().min(1),
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
})

const UpdateGuestAuthorSchema = CreateGuestAuthorSchema.partial()

// GET /api/admin/guest-authors — list all authors
export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json(await listGuestAuthorsAdmin())
}

// POST /api/admin/guest-authors — create author
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateGuestAuthorSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const { slug, ...data } = parsed.data

  const existing = await db.query.guestAuthor.findFirst({ where: eq(guestAuthor.slug, slug) })
  if (existing) {
    return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
  }

  const [created] = await db.insert(guestAuthor).values({ slug, ...data }).returning({ id: guestAuthor.id })
  const author = (await getGuestAuthorAdmin(created.id))!
  // ISR cache bust — see src/lib/revalidate.ts for the path map.

  revalidateAuthorData()

  return NextResponse.json(author, { status: 201 })
}
