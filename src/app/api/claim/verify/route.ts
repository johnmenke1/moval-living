import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/claim/verify?token=... — verify a claim token and return the business name.
//
// Response shape on success (200):
//   { business: { id, name }, expiresAt: ISO-string }
//
// Response shape on failure:
//   400 { error: 'token is required' }
//   404 { error: 'Invalid claim link' }                      — token doesn't match any business
//   410 { error: 'This listing has already been claimed' }   — ownerId already set
//   410 { error: 'This claim link has expired', expiredAt: ISO-string }
//
// The ClaimPageClient surfaces `expiredAt` in the UI so the user can
// see exactly when the link expired (useful when the user has an old
// email and is wondering if it's still good).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'token is required' }, { status: 400 })
  }

  const business = await prisma.business.findUnique({
    where: { claimToken: token },
    select: { id: true, name: true, ownerId: true, claimExpiresAt: true },
  })

  if (!business) {
    return NextResponse.json({ error: 'Invalid claim link' }, { status: 404 })
  }

  if (business.ownerId) {
    return NextResponse.json(
      { error: 'This listing has already been claimed' },
      { status: 410 },
    )
  }

  if (business.claimExpiresAt && new Date() > business.claimExpiresAt) {
    return NextResponse.json(
      {
        error: 'This claim link has expired',
        expiredAt: business.claimExpiresAt.toISOString(),
      },
      { status: 410 },
    )
  }

  return NextResponse.json({
    business: { id: business.id, name: business.name },
    expiresAt: business.claimExpiresAt ? business.claimExpiresAt.toISOString() : null,
  })
}