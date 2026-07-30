'use client'

import { Star } from 'lucide-react'

export default function DashboardUpgradeWidget() {
  const handleUpgrade = async (interval: 'monthly' | 'yearly') => {
    const res = await fetch(`/api/stripe/checkout?interval=${interval}`)
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      alert(data.error || 'Could not start checkout. Please try again.')
    }
  }

  return (
    <div className="bg-gradient-to-br from-[#007a7f] to-[#00405c] rounded-xl p-6 text-white">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-bold mb-1">Upgrade to Featured</h3>
          <p className="text-white/70 text-sm">
            Get homepage placement, priority ranking, and coupons — from $29/month.
          </p>
        </div>
        <Star className="w-6 h-6 text-[#c9786d] fill-[#c9786d] flex-shrink-0 ml-3" />
      </div>
      <div className="flex gap-3 mt-4">
        <button
          onClick={() => handleUpgrade('monthly')}
          className="flex-1 py-2 px-4 bg-white text-[#007a7f] rounded-lg font-semibold text-sm hover:bg-white/90 transition-colors"
        >
          $29/month
        </button>
        <button
          onClick={() => handleUpgrade('yearly')}
          className="flex-1 py-2 px-4 bg-[#c9786d] text-white rounded-lg font-semibold text-sm hover:bg-[#c9786d]/90 transition-colors"
        >
          $199/year — save 43%
        </button>
      </div>
      <p className="text-white/50 text-xs mt-3 text-center">Cancel anytime. No contracts.</p>
    </div>
  )
}
