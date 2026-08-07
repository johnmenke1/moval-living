import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { buildBusinessUpdateData, canManageBusiness } from '@/lib/business-mutations'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const session = await auth()
    const business = await prisma.business.findUnique({
      where: { slug },
      include: {
        category: true,
        reviews: {
          where: { flagged: false },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const canSeePrivateListing = canManageBusiness(
      session?.user?.id
        ? { userId: session.user.id, role: session.user.role }
        : null,
      business.ownerId,
    )

    if (business.status !== 'APPROVED' && !canSeePrivateListing) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: business.id,
      slug: business.slug,
      name: business.name,
      tagline: business.tagline,
      description: business.description,
      categoryId: business.categoryId,
      category: business.category,
      tier: business.tier,
      status: business.status,
      email: business.email,
      phone: business.phone,
      website: business.website,
      address: business.address,
      city: business.city,
      state: business.state,
      zip: business.zip,
      latitude: business.latitude,
      longitude: business.longitude,
      logo: business.logo,
      coverImage: business.coverImage,
      photos: business.photos,
      facebook: business.facebook,
      instagram: business.instagram,
      yelp: business.yelp,
      googleBusiness: business.googleBusiness,
      googleRating: business.googleRating,
      googleReviewCount: business.googleReviewCount,
      hours: business.hours,
      metaTitle: business.metaTitle,
      metaDescription: business.metaDescription,
      hasCoupon: business.hasCoupon,
      coupon: business.coupon,
      ownerId: business.ownerId,
      reviews: business.reviews,
      isExpertPartner: business.isExpertPartner,
      expertPartnerSlug: business.expertPartnerSlug,
      foundingPartnerSince: business.foundingPartnerSince,
      liveQaZoomUrl: business.liveQaZoomUrl,
      liveQaNextDate: business.liveQaNextDate,
      createdAt: business.createdAt,
      updatedAt: business.updatedAt,
    })
  } catch (error) {
    console.error('Business fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { slug } = await params
    const existing = await prisma.business.findUnique({
      where: { slug },
      select: { id: true, ownerId: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (!canManageBusiness(
      { userId: session.user.id, role: session.user.role },
      existing.ownerId,
    )) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = buildBusinessUpdateData(await request.json())
    const business = await prisma.business.update({
      where: { id: existing.id },
      data,
    })

    return NextResponse.json(business)
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ZodError') {
      // Zod 4 exposes the issue list as `issues`, not `errors`. Reading the
      // old field returns undefined → empty fields object → client toast with
      // no highlighted field. Always read `.issues` (typed correctly below).
      const zerr = error as { issues?: Array<{ path: (string | number)[]; message: string }> }
      const fields = (zerr.issues || []).reduce<Record<string, string>>((acc, e) => {
        acc[e.path.join('.')] = e.message
        return acc
      }, {})
      return NextResponse.json(
        { error: 'Validation failed', fields },
        { status: 400 }
      )
    }
    console.error('Business update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
