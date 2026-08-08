import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getStripe } from '@/lib/stripe'

/**
 * POST /api/admin/diagnostics/stripe-prices
 *
 * Admin-only. Verifies each STRIPE_PRICE_* env var by calling Stripe's
 * prices.retrieve() for each. Returns a per-tier diagnostic so you can
 * quickly see which price IDs are valid in the current Stripe account
 * and which need to be recreated.
 *
 * Use this after switching Stripe accounts, recreating products, or
 * migrating test→live.
 */
export async function POST(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const prices = {
    featured_monthly: process.env.STRIPE_PRICE_MONTHLY,
    featured_yearly: process.env.STRIPE_PRICE_YEARLY,
    expert_monthly: process.env.STRIPE_PRICE_EXPERT_MONTHLY,
    expert_yearly: process.env.STRIPE_PRICE_EXPERT_YEARLY,
  }

  const results: Record<string, {
    envValue: string | undefined
    valid: boolean
    detail?: string
    amount?: string
    interval?: string
    active?: boolean
    errorCode?: string
  }> = {}

  const stripe = getStripe()
  for (const [key, id] of Object.entries(prices)) {
    if (!id) {
      results[key] = {
        envValue: undefined,
        valid: false,
        detail: 'env var not set',
      }
      continue
    }
    try {
      const price = await stripe.prices.retrieve(id)
      results[key] = {
        envValue: id,
        valid: true,
        amount: `${(price.unit_amount ?? 0) / 100} ${price.currency?.toUpperCase()}`,
        interval: price.recurring?.interval ?? 'one-time',
        active: price.active,
        detail: price.active ? 'valid' : 'valid but inactive — reactivate in Stripe Dashboard',
      }
    } catch (err) {
      const e = err as Error & { raw?: { code?: string; message?: string } }
      results[key] = {
        envValue: id,
        valid: false,
        errorCode: e.raw?.code,
        detail: e.raw?.message ?? e.message,
      }
    }
  }

  const allValid = Object.values(results).every((r) => r.valid)
  const allSet = Object.values(results).every((r) => r.envValue)

  return NextResponse.json({
    allValid,
    allSet,
    results,
    hint: allValid
      ? 'All price IDs are valid in the current Stripe account.'
      : 'Some price IDs are invalid. They may be from a different Stripe account, or the products may have been deleted. Re-create the missing products in Stripe Dashboard and paste the new price IDs into Vercel.',
  })
}