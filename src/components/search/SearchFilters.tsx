'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { SlidersHorizontal, X, Store, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchFiltersProps {
  categories: Array<{ id: string; name: string; slug: string }>
  currentParams: {
    q?: string
    category?: string
    tier?: string
    espanol?: string
  }
  // Categories present in the current result set, alphabetical. Drives
  // the jump-to-anchor pills under the search bar. Pass [] when there are
  // no results.
  categoryNav: Array<{ slug: string; name: string }>
}

/**
 * Secondary filters that live in the scrolling header card. The
 * search input + language toggle + Clear-all button were split out into
 * the dedicated <CompactSearchBar /> so the sticky bar can be smaller and
 * the header card scrolls away naturally once the user is reading
 * listings.
 *
 * What lives here: category dropdown (legacy deep-link filter) and the
 * category jump-to pill nav (alphabetical, scrolls on click).
 *
 * What dropped: tier filter (Featured/Free/Chamber) — Johnny flagged those
 * buttons as not earning their space; users can still filter by tier via
 * direct URL params for any deep-link compatibility we need.
 */
export function SearchFilters({ categories, currentParams, categoryNav }: SearchFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    startTransition(() => {
      router.push(`/search?${params.toString()}`)
    })
  }

  // Deep-link support: /search?category=X arrives here with the category
  // set in the URL but the page rendered all categories. Scroll the
  // matching group into view once on mount.
  useEffect(() => {
    if (currentParams.category && typeof window !== 'undefined') {
      // Wait one frame so the layout settles.
      const id = window.requestAnimationFrame(() => {
        const el = document.getElementById(`cat-${currentParams.category}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return () => window.cancelAnimationFrame(id)
    }
  }, [currentParams.category])

  const hasMobileFilters = Boolean(currentParams.category)

  return (
    <div className="flex flex-col gap-4">
      {/* Mobile filter toggle — kept for the legacy deep-link category
          dropdown. Mobile users get a tap-to-expand panel since the
          dropdown takes a row of its own at narrow widths. */}
      <div className="md:hidden">
        <button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 hover:bg-white transition-colors text-sm font-semibold text-text-secondary"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            {currentParams.category
              ? `Category: ${categories.find(c => c.slug === currentParams.category)?.name ?? 'Unknown'}`
              : 'Browse by category'}
          </span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', showMobileFilters && 'rotate-180')} />
        </button>
        {showMobileFilters && (
          <div className="mt-3 p-3 bg-white/80 rounded-xl border border-slate-200">
            <select
              value={currentParams.category || ''}
              onChange={(e) => updateParam('category', e.target.value)}
              className="input"
              aria-label="Filter to a single category"
            >
              <option value="">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.slug}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Desktop category select (legacy deep-link filter). */}
      <div className="hidden md:flex items-center gap-3">
        <select
          value={currentParams.category || ''}
          onChange={(e) => updateParam('category', e.target.value)}
          className="input py-2.5 w-auto min-w-[200px] bg-white/80 backdrop-blur rounded-xl text-sm"
          aria-label="Filter to a single category"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* Sub-label clarifying this is a secondary filter row */}
        {categoryNav.length > 1 && (
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Jump to:
          </span>
        )}
      </div>

      {/* Category jump-to pills — scroll away with the header card so
          they naturally disappear once the user is reading listings.
          Pill style matches the /events segmented control treatment. */}
      {categoryNav.length > 1 && (
        <nav aria-label="Jump to category" className="hidden md:flex flex-wrap gap-2 pt-1">
          {categoryNav.map((cat) => {
            const active = currentParams.category === cat.slug
            return (
              <a
                key={cat.slug}
                href={`#cat-${cat.slug}`}
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors',
                  active
                    ? 'bg-primary text-white'
                    : 'bg-white/70 border border-slate-200 text-text-secondary hover:border-primary/40 hover:text-primary',
                )}
              >
                <Store className="w-3 h-3" />
                {cat.name}
              </a>
            )
          })}
        </nav>
      )}

      {/* Mobile: category pills below the toggle, scroll away with header. */}
      {categoryNav.length > 1 && (
        <nav aria-label="Jump to category" className="md:hidden flex flex-wrap gap-2">
          {categoryNav.map((cat) => {
            const active = currentParams.category === cat.slug
            return (
              <a
                key={cat.slug}
                href={`#cat-${cat.slug}`}
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors',
                  active
                    ? 'bg-primary text-white'
                    : 'bg-white/70 border border-slate-200 text-text-secondary',
                )}
              >
                {cat.name}
              </a>
            )
          })}
        </nav>
      )}
    </div>
  )
}