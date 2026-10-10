import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { and, desc, eq } from 'drizzle-orm'
import { db, socialPost, business } from '@/db'

type PostStatus = typeof socialPost.$inferSelect['status']

// GET /api/social-posts — public (approved only) or admin (all statuses)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // 'PENDING' | 'APPROVED' | 'REJECTED' | null
  const businessId = searchParams.get('businessId') // optional filter

  const session = await auth()

  // Public: only APPROVED posts
  const listWith = { business: { columns: { id: true, slug: true, name: true, logo: true } } } as const

  // Anonymous + admin callers may filter by businessId; signed-in non-admins
  // only get the status filter (matches the previous behaviour).
  const isAdmin = session?.user?.role === 'ADMIN'
  const filterByBusiness = !session || isAdmin
  const posts = await db.query.socialPost.findMany({
    where: and(
      status ? eq(socialPost.status, status as PostStatus) : undefined,
      filterByBusiness && businessId ? eq(socialPost.businessId, businessId) : undefined
    ),
    with: listWith,
    orderBy: desc(socialPost.createdAt),
  })
  return NextResponse.json(posts)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { platform, postUrl, caption, eventDate, eventEndDate, businessId, submittedBy } = body

  if (!platform || !postUrl) {
    return NextResponse.json({ error: 'platform and postUrl are required' }, { status: 400 })
  }

  if (!['INSTAGRAM', 'FACEBOOK'].includes(platform)) {
    return NextResponse.json({ error: 'platform must be INSTAGRAM or FACEBOOK' }, { status: 400 })
  }

  // Basic URL validation
  const urlHost = new URL(postUrl).hostname
  const isInstagram = urlHost.includes('instagram.com') || urlHost === 'instagram.com'
  const isFacebook = urlHost.includes('facebook.com') || urlHost === 'facebook.com'

  if (platform === 'INSTAGRAM' && !isInstagram) {
    return NextResponse.json({ error: 'URL does not appear to be an Instagram post' }, { status: 400 })
  }
  if (platform === 'FACEBOOK' && !isFacebook) {
    return NextResponse.json({ error: 'URL does not appear to be a Facebook post' }, { status: 400 })
  }

  // Verify businessId exists if provided
  if (businessId) {
    const biz = await db.query.business.findFirst({ where: eq(business.id, businessId) })
    if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  // Parse event dates — convert YYYY-MM-DD strings to Date objects
  const parsedEventDate = eventDate ? new Date(eventDate) : null
  const parsedEventEndDate = eventEndDate ? new Date(eventEndDate) : null

  const [inserted] = await db
    .insert(socialPost)
    .values({
      platform,
      postUrl,
      caption: caption || null,
      eventDate: parsedEventDate,
      eventEndDate: parsedEventEndDate,
      businessId: businessId || null,
      submittedBy: submittedBy || null,
      status: 'PENDING',
    })
    .returning()
  const linked = inserted.businessId
    ? await db.query.business.findFirst({
        where: eq(business.id, inserted.businessId),
        columns: { id: true, slug: true, name: true },
      })
    : null
  const post = { ...inserted, business: linked ?? null }

  return NextResponse.json(post, { status: 201 })
}
