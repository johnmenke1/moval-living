'use client'

import { useState } from 'react'
import { Building2, MessageSquare, Trophy } from 'lucide-react'
import BusinessesModeration from '@/components/admin/BusinessesModeration'
import SocialPostsModeration from '@/components/admin/SocialPostsModeration'
import BestOfAdmin from '@/components/admin/BestOfAdmin'
import { clsx } from 'clsx'

// We accept the same data shapes that the dashboard server component
// already fetches and passes to the three moderation panels. Types are
// structural — each child component validates its own prop shape.
interface AdminTabsProps {
  businesses: any[]
  posts: any[]
  bestOfCategories: any[]
}

type TabKey = 'businesses' | 'social' | 'bestof'

const TABS: { key: TabKey; label: string; icon: typeof Building2; count?: (p: AdminTabsProps) => number }[] = [
  { key: 'businesses', label: 'Businesses', icon: Building2,
    count: (p) => p.businesses.filter((b: any) => b.status === 'PENDING').length },
  { key: 'social', label: 'Social Posts', icon: MessageSquare,
    count: (p) => p.posts.filter((x: any) => x.status === 'PENDING').length },
  { key: 'bestof', label: 'Best Of', icon: Trophy,
    count: (p) => p.bestOfCategories.length },
]

export default function AdminTabs({ businesses, posts, bestOfCategories }: AdminTabsProps) {
  const [active, setActive] = useState<TabKey>('businesses')

  return (
    <div>
      {/* Tab nav */}
      <div className="border-b border-slate-200 mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max" role="tablist">
          {TABS.map(({ key, label, icon: Icon, count }) => {
            const n = count?.({ businesses, posts, bestOfCategories }) ?? 0
            const isActive = active === key
            return (
              <button
                key={key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(key)}
                className={clsx(
                  'inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-text-secondary hover:text-text hover:border-slate-300'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
                {n > 0 && (
                  <span
                    className={clsx(
                      'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-bold',
                      isActive ? 'bg-primary text-white' : 'bg-slate-200 text-text-secondary'
                    )}
                  >
                    {n}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active panel — only render the visible one to keep DOM light */}
      <div role="tabpanel">
        {active === 'businesses' && <BusinessesModeration initialBusinesses={businesses} />}
        {active === 'social' && <SocialPostsModeration initialPosts={posts} />}
        {active === 'bestof' && <BestOfAdmin initialCategories={bestOfCategories} />}
      </div>
    </div>
  )
}
