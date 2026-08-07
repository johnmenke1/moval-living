'use client'

import { Star, Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function DashboardUpgradeWidget() {
  const handleUpgrade = async (
    tier: 'featured' | 'expert',
    interval: 'monthly' | 'yearly'
  ) => {
    const res = await fetch(
      `/api/stripe/checkout?interval=${interval}&tier=${tier}`
    )
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      alert(data.error || 'Could not start checkout. Please try again.')
    }
  }

  return (
    <div className="space-y-4">
      {/* Featured upgrade */}
      <div className="bg-gradient-to-br from-[#007a7f] to-[#00405c] rounded-xl p-6 text-white">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-lg font-bold mb-1">Upgrade to Featured</h3>
            <p className="text-white/70 text-sm">
              Get homepage placement, priority ranking, and coupons — from
              $29/month.
            </p>
          </div>
          <Star className="w-6 h-6 text-[#c9786d] fill-[#c9786d] flex-shrink-0 ml-3" />
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => handleUpgrade('featured', 'monthly')}
            className="flex-1 py-2 px-4 bg-white text-[#007a7f] rounded-lg font-semibold text-sm hover:bg-white/90 transition-colors"
          >
            $29/month
          </button>
          <button
            onClick={() => handleUpgrade('featured', 'yearly')}
            className="flex-1 py-2 px-4 bg-[#c9786d] text-white rounded-lg font-semibold text-sm hover:bg-[#c9786d]/90 transition-colors"
          >
            $199/year — save 43%
          </button>
        </div>
      </div>

      {/* Expert Partner upgrade */}
      <div className="bg-gradient-to-br from-amber-500 to-yellow-400 rounded-xl p-6 text-amber-950">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide bg-amber-950/20 px-2 py-0.5 rounded-full mb-2">
              <Sparkles className="w-3 h-3" />
              Limited — one per category
            </div>
            <h3 className="text-lg font-bold mb-1">Become an Expert Partner</h3>
            <p className="text-amber-900/80 text-sm">
              Monthly feature story, social promotion, newsletter placement, lead
              capture — a real ongoing local PR engine.
            </p>
          </div>
          <Sparkles className="w-6 h-6 text-amber-950 flex-shrink-0 ml-3" />
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => handleUpgrade('expert', 'monthly')}
            className="flex-1 py-2 px-4 bg-amber-950 text-white rounded-lg font-semibold text-sm hover:bg-amber-900 transition-colors"
          >
            $197/month
          </button>
          <button
            onClick={() => handleUpgrade('expert', 'yearly')}
            className="flex-1 py-2 px-4 bg-white text-amber-900 border-2 border-amber-950 rounded-lg font-semibold text-sm hover:bg-amber-50 transition-colors"
          >
            $997/year — save $367
          </button>
        </div>
        <Link
          href="/partners"
          className="block text-center text-xs font-semibold text-amber-900 hover:underline mt-3"
        >
          See open categories &amp; what you get →
        </Link>
      </div>
    </div>
  )
}