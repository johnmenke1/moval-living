import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getStripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export type CheckoutTier = 'featured' | 'expert'

// GET handler — diagnostic only. Returns which Stripe env vars are set
// so admins can verify the checkout button will work.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'Use POST to start checkout; admin-only diagnostic on GET' },
      { status: 401 }
    )
  }
  return NextResponse.json({
    envConfigured: {
      stripeMonthly: !!process.env.STRIPE_PRICE_MONTHLY,
      stripeYearly: !!process.env.STRIPE_PRICE_YEARLY,
      expertMonthly: !!process.env.STRIPE_PRICE_EXPERT_MONTHLY,
      expertYearly: !!process.env.STRIPE_PRICE_EXPERT_YEARLY,
    },
    message: 'Use POST to actually start a checkout',
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const interval = searchParams.get('interval') === 'yearly' ? 'yearly' : 'monthly'
  const tier: CheckoutTier = searchParams.get('tier') === 'expert' ? 'expert' : 'featured'

  const owner = await prisma.owner.findUnique({
    where: { id: session.user.id },
    include: { business: true },
  })

  if (!owner?.business) {
    return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })
  }

  // Already subscribed at the requested tier?
  if (
    owner.business.stripeSubscriptionId &&
    owner.business.subscriptionStatus === 'active' &&
    (tier === 'featured'
      ? owner.business.tier === 'FEATURED'
      : owner.business.tier === 'EXPERT_PARTNER')
  ) {
    return NextResponse.json(
      { error: `Already subscribed to ${tier === 'expert' ? 'Expert Partner' : 'Featured'}` },
      { status: 400 }
    )
  }

  const priceId =
    tier === 'expert'
      ? interval === 'yearly'
        ? process.env.STRIPE_PRICE_EXPERT_YEARLY
        : process.env.STRIPE_PRICE_EXPERT_MONTHLY
      : interval === 'yearly'
        ? process.env.STRIPE_PRICE_YEARLY
        : process.env.STRIPE_PRICE_MONTHLY

  if (!priceId) {
    return NextResponse.json(
      {
        error: tier === 'expert'
          ? 'Expert Partner price not configured. Set STRIPE_PRICE_EXPERT_MONTHLY / STRIPE_PRICE_EXPERT_YEARLY env vars.'
          : 'Featured price not configured. Set STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY env vars.',
      },
      { status: 500 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.moval.living'

  // Upsert Stripe customer
  let customerId = owner.business.stripeCustomerId
  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: owner.email,
      name: owner.business.name,
      metadata: { businessId: owner.business.id },
    })
    customerId = customer.id
    await prisma.business.update({
      where: { id: owner.business.id },
      data: { stripeCustomerId: customerId },
    })
  }

  const checkoutSession = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/dashboard?upgrade=success&tier=${tier}`,
    cancel_url: `${appUrl}/dashboard?upgrade=canceled&tier=${tier}`,
    metadata: {
      businessId: owner.business.id,
      tier, // 'featured' | 'expert' — used by webhook to pick the right tier
    },
    subscription_data: {
      metadata: {
        businessId: owner.business.id,
        tier,
      },
    },
  })

  if (!checkoutSession.url) {
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }

  return NextResponse.json({ url: checkoutSession.url })
}