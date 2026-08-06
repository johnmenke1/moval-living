'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, X, Star, Zap, Shield, TrendingUp, Image, Tag } from 'lucide-react'
import { clsx } from 'clsx'
import { FaqSection } from '@/components/seo/FaqSection'

const features = [
  { label: 'Basic listing', free: true, featured: true },
  { label: 'Contact info & map', free: true, featured: true },
  { label: 'Up to 3 photos', free: true, featured: true },
  { label: 'Reviews & ratings', free: true, featured: true },
  { label: 'Featured badge on listing', free: false, featured: true },
  { label: 'Homepage featured section', free: false, featured: true },
  { label: 'Priority search ranking', free: false, featured: true },
  { label: 'Up to 8 photos', free: false, featured: true },
  { label: 'Coupons & deals', free: false, featured: true },
  { label: 'Full analytics dashboard', free: false, featured: true },
]

export default function PricingPageClient() {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState<'monthly' | 'yearly' | null>(null)

  const handleUpgrade = async (interval: 'monthly' | 'yearly') => {
    if (!session) {
      router.push('/login?callbackUrl=/pricing')
      return
    }

    setLoading(interval)
    try {
      const res = await fetch(`/api/stripe/checkout?interval=${interval}`)
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || 'Could not start checkout. Please try again.')
      }
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="bg-[#f0efeb] min-h-screen">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#007a7f] to-[#00405c] text-white py-20">
        <div className="container-max text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Simple, transparent pricing</h1>
          <p className="text-white/80 text-lg max-w-xl mx-auto">
            Start free. Upgrade to Featured when you&apos;re ready to reach more customers in Moreno Valley.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="container-max py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Free */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-[#1a2e35] mb-2">Free</h2>
            <p className="text-[#5a6c72] mb-6">Everything you need to get listed and found.</p>
            <div className="mb-6">
              <span className="text-5xl font-bold text-[#1a2e35]">$0</span>
              <span className="text-[#5a6c72]">/month</span>
            </div>
            <Link
              href="/submit"
              className="block w-full py-3 px-6 text-center rounded-lg border-2 border-slate-200 text-[#1a2e35] font-semibold hover:border-[#007a7f] hover:text-[#007a7f] transition-colors"
            >
              Get Started Free
            </Link>
          </div>

          {/* Featured */}
          <div className="bg-white rounded-2xl border-2 border-[#007a7f] p-8 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-[#007a7f] text-white text-sm font-bold px-4 py-1 rounded-full">
                Most Popular
              </span>
            </div>
            <h2 className="text-2xl font-bold text-[#1a2e35] mb-2">Featured</h2>
            <p className="text-[#5a6c72] mb-6">Get seen by more local customers, every day.</p>
            <div className="mb-6">
              <span className="text-5xl font-bold text-[#1a2e35]">$29</span>
              <span className="text-[#5a6c72]">/month</span>
            </div>
            {session ? (
              <>
                <button
                  onClick={() => handleUpgrade('monthly')}
                  disabled={!!loading}
                  className="block w-full py-3 px-6 text-center rounded-lg bg-[#007a7f] text-white font-semibold hover:bg-[#006a70] transition-colors disabled:opacity-50 mb-3"
                >
                  {loading === 'monthly' ? 'Redirecting to Stripe...' : 'Upgrade Monthly — $29/mo'}
                </button>
                <button
                  onClick={() => handleUpgrade('yearly')}
                  disabled={!!loading}
                  className="block w-full py-3 px-6 text-center rounded-lg border-2 border-[#c9786d] text-[#c9786d] font-semibold hover:bg-[#c9786d]/10 transition-colors disabled:opacity-50"
                >
                  {loading === 'yearly' ? 'Redirecting to Stripe...' : 'Upgrade Yearly — $199/yr (save 43%)'}
                </button>
              </>
            ) : (
              <Link
                href="/login?callbackUrl=/pricing"
                className="block w-full py-3 px-6 text-center rounded-lg bg-[#007a7f] text-white font-semibold hover:bg-[#006a70] transition-colors"
              >
                Log In to Upgrade
              </Link>
            )}
          </div>
        </div>

        {/* Feature Table */}
        <div className="max-w-4xl mx-auto mt-16 bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-3 gap-4 p-6 bg-slate-50 border-b border-slate-100">
            <div className="text-sm font-medium text-[#5a6c72]" />
            <div className="text-center">
              <p className="font-bold text-[#1a2e35]">Free</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-[#007a7f]">⭐ Featured</p>
            </div>
          </div>
          {features.map((feature, i) => (
            <div
              key={feature.label}
              className={clsx(
                'grid grid-cols-3 gap-4 p-4 items-center',
                i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
              )}
            >
              <div className="text-[#1a2e35] text-sm">{feature.label}</div>
              <div className="text-center">
                {feature.free ? (
                  <Check className="w-5 h-5 text-green-500 mx-auto" />
                ) : (
                  <X className="w-5 h-5 text-slate-300 mx-auto" />
                )}
              </div>
              <div className="text-center">
                <Check className="w-5 h-5 text-[#007a7f] mx-auto" />
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="max-w-2xl mx-auto mt-12 text-center">
          <p className="text-[#5a6c72] text-sm">
            Featured listings are billed monthly ($29/mo) or annually ($199/yr, save 43%).
            Cancel anytime — your listing stays free but loses Featured status at the end of the billing period.
          </p>
        </div>
      </div>

      <FaqSection
        title="Pricing Questions"
        subtitle="Everything you need to know about listing on moval.living."
        faqs={[
          {
            question: 'Is there a free plan?',
            answer:
              'Yes. The Free plan gives you a full business listing with contact info, map, photos, and access to reviews — at no cost, forever.',
          },
          {
            question: 'What happens when I upgrade to Featured?',
            answer:
              'Featured listings appear at the top of category pages and the homepage, include a highlighted badge, and support up to 10 photos plus coupon creation.',
          },
          {
            question: 'Can I cancel my Featured subscription at any time?',
            answer:
              'Yes. Cancel anytime from your dashboard. Your listing remains live as a Free listing — nothing disappears, you just lose the Featured perks.',
          },
          {
            question: 'What payment methods do you accept?',
            answer:
              'We accept all major credit and debit cards through Stripe. Payments are processed securely and billed monthly or annually depending on your plan.',
          },
          {
            question: 'Can I switch from monthly to annual billing?',
            answer:
              'Yes. You can switch to annual billing at any time. Annual billing is $199/year (equivalent to $16.58/month) — a 43% savings versus monthly.',
          },
        ]}
      />
    </div>
  )
}
