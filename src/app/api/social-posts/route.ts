import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { PostStatus } from '@prisma/client'

// GET /api/social-posts — public (approved only) or admin (all statuses)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') // 'PENDING' | 'APPROVED' | 'REJECTED' | null
  const businessId = searchParams.get('businessId') // optional filter

  const session = await auth()

  // Public: only APPROVED posts
  if (!session) {
    const posts = await prisma.socialPost.findMany({
      where: {
        ...(status ? { status: status as PostStatus } : {}),
        ...(businessId ? { businessId } : {}),
      },
      include: { business: { select: { id: true, slug: true, name: true, logo: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(posts)
  }

  // Authed: show all if admin/owner, otherwise only their own
  const isAdmin = session.user?.role === 'ADMIN'

  if (isAdmin) {
    const posts = await prisma.socialPost.findMany({
      where: { ...(status ? { status: status as PostStatus } : {}), ...(businessId ? { businessId } : {}) },
      include: { business: { select: { id: true, slug: true, name: true, logo: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(posts)
  }

  // Logged-in owner: return all their posts
  const posts = await prisma.socialPost.findMany({
    where: { ...(status ? { status: status as PostStatus } : {}) },
    include: { business: { select: { id: true, slug: true, name: true, logo: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(posts)
}

// POST /api/social-posts — submit a new post URL (public)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { platform, postUrl, caption, businessId, submittedBy } = body

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
    const biz = await prisma.business.findUnique({ where: { id: businessId } })
    if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const post = await prisma.socialPost.create({
    data: {
      platform,
      postUrl,
      caption: caption || null,
      businessId: businessId || null,
      submittedBy: submittedBy || null,
      status: 'PENDING',
    },
    include: { business: { select: { id: true, slug: true, name: true } } },
  })

  return NextResponse.json(post, { status: 201 })
}
