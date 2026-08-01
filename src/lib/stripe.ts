import Stripe from 'stripe'

// Lazy initialization so the module loads without crashing during build
// when STRIPE_SECRET_KEY isn't set locally
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    _stripe = new Stripe(key, {
      apiVersion: '2026-07-29.dahlia',
      typescript: true,
    })
  }
  return _stripe
}

// Convenience export for backwards compat
export const stripe = {
  get checkout() { return getStripe().checkout },
  get subscriptions() { return getStripe().subscriptions },
  get customers() { return getStripe().customers },
  get webhooks() { return getStripe().webhooks },
}
