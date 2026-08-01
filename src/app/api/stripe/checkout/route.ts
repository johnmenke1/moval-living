import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getStripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const interval = searchParams.get('interval') === 'yearly' ? 'yearly' : 'monthly'

  const owner = await prisma.owner.findUnique({
    where: { id: session.user.id },
    include: { business: true },
  })

  if (!owner?.business) {
    return NextResponse.json({ error: 'No business found for this account' }, { status: 404 })
  }

  // Already subscribed?
  if (owner.business.stripeSubscriptionId && owner.business.subscriptionStatus === 'active') {
    return NextResponse.json({ error: 'Already subscribed' }, { status: 400 })
  }

  const priceId = interval === 'yearly'
    ? process.env.STRIPE_PRICE_YEARLY
    : process.env.STRIPE_PRICE_MONTHLY

  if (!priceId) {
    return NextResponse.json(
      { error: 'Price not configured. Set STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY env vars.' },
      { status: 500 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moval.living'

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
    success_url: `${appUrl}/dashboard?upgrade=success`,
    cancel_url: `${appUrl}/dashboard?upgrade=canceled`,
    metadata: { businessId: owner.business.id },
    subscription_data: {
      metadata: { businessId: owner.business.id },
    },
  })

  if (!checkoutSession.url) {
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }

  return NextResponse.json({ url: checkoutSession.url })
}
