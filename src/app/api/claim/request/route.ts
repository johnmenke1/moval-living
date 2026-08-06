import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

// POST /api/claim/request
// Public — anyone can request to claim a business they own.
// Creates a claimToken and sends a magic link to verify ownership.
export async function POST(request: NextRequest) {
  try {
    const { slug, email } = await request.json()

    if (!slug || !email) {
      return NextResponse.json({ error: 'Missing business slug or email' }, { status: 400 })
    }

    const business = await prisma.business.findUnique({
      where: { slug },
      select: { id: true, name: true, status: true, ownerId: true },
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    if (business.ownerId) {
      return NextResponse.json({ error: 'This listing is already claimed' }, { status: 409 })
    }

    if (business.status !== 'APPROVED') {
      return NextResponse.json({ error: 'This listing is not yet approved' }, { status: 403 })
    }

    const claimToken = nanoid(32)
    const claimExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    await prisma.business.update({
      where: { id: business.id },
      data: { claimToken, claimExpiresAt },
    })

    // Build the claim URL
    const baseUrl = process.env.NEXTAUTH_URL || 'https://www.moval.living'
    const claimUrl = `${baseUrl}/claim?token=${claimToken}`

    // TODO: Send email via SES with the claim link
    // For now, return the claim URL so the caller can display it or log it
    return NextResponse.json({
      success: true,
      claimUrl,
      message: `Claim link generated for ${business.name}. Send this link to ${email} to verify ownership.`,
    })
  } catch (error) {
    console.error('Claim request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
