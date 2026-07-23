import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// GET /api/businesses/by-email?email=... — find businesses submitted by a given email
// Used by the "My Submissions" page to let unauthenticated submitters find their businesses
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')

  if (!email?.trim()) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  const businesses = await prisma.business.findMany({
    where: {
      email: email.trim().toLowerCase(),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      phone: true,
      status: true,
      createdAt: true,
      category: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ businesses })
}
