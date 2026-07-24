import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/claim/verify?token=... — verify a claim token and return the business name
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
    return NextResponse.json({ error: 'This listing has already been claimed' }, { status: 410 })
  }

  if (business.claimExpiresAt && new Date() > business.claimExpiresAt) {
    return NextResponse.json({ error: 'This claim link has expired' }, { status: 410 })
  }

  return NextResponse.json({ business: { id: business.id, name: business.name } })
}
