'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { SlidersHorizontal, Store, ChevronDown, X } from 'lucide-react'
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
 * Secondary filters that live INSIDE the /search hero. Before Aug 27,
 * the search input + language toggle + Clear-all button were split out
 * into the dedicated <CompactSearchBar /> so the sticky bar could be
 * smaller; the hero was a separate "header card" that scrolled away.
 *
 * As of the /search hero makeover (commit `feat(search): photo hero`),
 * the page has a single photo hero that owns BOTH the search input
 * (CompactSearchBar) and this filter component. The old sticky bar is
 * gone — the hero is the single source of truth for filtering /search.
 *
 * What lives here: category dropdown filter and the category filter-pill
 * nav. Selecting a category in the dropdown OR clicking a pill narrows
 * the /search results in-place — the map and card grid both narrow to
 * that category. The page snaps back to the top on filter change so the
 * narrowed map stays visible above the fold (see scrollTo effect above).
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

  // When the user clicks a category pill/dropdown to filter /search, the
  // page re-renders server-side but the browser scroll position is
  // preserved — which usually leaves them scrolled past the head card
  // and past the map, so they "lose the map" visually even though it's
  // still on the page. Snap the viewport back to the top of the page
  // when the active category changes (filter just applied), but not on
  // the very first render (initial mount) so we don't yank the user up
  // from a deep-link /search?category=... they've already scrolled.
  const prevCategoryRef = useRef<string | undefined>(currentParams.category)
  useEffect(() => {
    const prev = prevCategoryRef.current
    const next = currentParams.category
    if (prev !== next && next !== undefined) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    prevCategoryRef.current = next
  }, [currentParams.category])

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

  // Picking a category in the dropdown filters /search in-place. The map
  // and card grid both narrow to that category. We still keep the
  // /category/[slug] landing pages as canonical SEO pages; a small link
  // on the filtered view points there for search engines.
  const goToCategory = (slug: string) => {
    updateParam('category', slug)
  }

  // When a category is actively selected, the page renders only that
  // category's section, so the jump-to pills are hidden.
  const isFiltered = Boolean(currentParams.category)
  const hasMobileFilters = isFiltered

  return (
    <div className="flex flex-col gap-4">
      {/* Mobile filter toggle — category dropdown lives in the expandable
          panel. Selecting a category filters /search in-place. */}
      <div className="md:hidden">
        <button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 hover:bg-white transition-colors text-sm font-semibold text-text-secondary"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" />
            {isFiltered
              ? `Category: ${categories.find(c => c.slug === currentParams.category)?.name ?? 'Unknown'}`
              : 'Browse by category'}
          </span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', showMobileFilters && 'rotate-180')} />
        </button>
        {showMobileFilters && (
          <div className="mt-3 p-3 bg-white/80 rounded-xl border border-slate-200">
            <select
              value={currentParams.category || ''}
              onChange={(e) => goToCategory(e.target.value)}
              className="input"
              aria-label="View a single category"
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

      {/* Desktop category select. Picking a category filters /search. */}
      <div className="hidden md:flex items-center gap-3">
        <select
          value={currentParams.category || ''}
          onChange={(e) => goToCategory(e.target.value)}
          className="input py-2.5 w-auto min-w-[200px] bg-white/80 backdrop-blur rounded-xl text-sm"
          aria-label="View a single category"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* Sub-label clarifying this is a secondary filter row */}
        {!isFiltered && categoryNav.length > 1 && (
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Jump to:
          </span>
        )}
      </div>

      {/* Category jump-to pills — now act as quick category filters so the
          behavior matches the dropdown. Selecting one narrows the map and
          grid; the active pill is highlighted. */}
      {!isFiltered && categoryNav.length > 1 && (
        <nav aria-label="Filter by category" className="hidden md:flex flex-wrap gap-2 pt-1">
          {categoryNav.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => goToCategory(cat.slug)}
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors',
                'bg-white/70 border border-slate-200 text-text-secondary hover:border-primary/40 hover:text-primary',
              )}
            >
              <Store className="w-3 h-3" />
              {cat.name}
            </button>
          ))}
        </nav>
      )}

      {/* Mobile: category pills below the toggle; filter behavior. */}
      {!isFiltered && categoryNav.length > 1 && (
        <nav aria-label="Filter by category" className="md:hidden flex flex-wrap gap-2">
          {categoryNav.map((cat) => (
            <button
              key={cat.slug}
              onClick={() => goToCategory(cat.slug)}
              className={cn(
                'inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors',
                'bg-white/70 border border-slate-200 text-text-secondary',
              )}
            >
              {cat.name}
            </button>
          ))}
        </nav>
      )}

      {/* Clear filter chip — appears when a category is selected so the user
          can return to the full directory/map view. */}
      {isFiltered && (
        <button
          onClick={() => goToCategory('')}
          className="inline-flex items-center gap-1.5 self-start text-xs font-semibold px-3 py-1.5 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          <X className="w-3 h-3" />
          Clear category filter
        </button>
      )}
    </div>
  )
}
