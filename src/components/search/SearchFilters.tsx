'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Languages, Search, SlidersHorizontal, X, Store } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchFiltersProps {
  categories: Array<{ id: string; name: string; slug: string }>
  currentParams: {
    q?: string
    category?: string
    tier?: string
    espanol?: string
  }
  resultCount: number
  // Categories present in the current result set, alphabetical. Drives
  // the jump-to-anchor pills under the search bar. Pass [] when there are
  // no results.
  categoryNav: Array<{ slug: string; name: string }>
}

export function SearchFilters({ categories, currentParams, resultCount, categoryNav }: SearchFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [showFilters, setShowFilters] = useState(false)

  // Controlled search input — mirrors the events SearchBar so all clear
  // paths (Escape, backspace-to-empty, custom X) actually reset the page.
  const [queryValue, setQueryValue] = useState(currentParams.q ?? '')
  useEffect(() => {
    setQueryValue(currentParams.q ?? '')
  }, [currentParams.q])

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

  const submitQuery = (next: string) => {
    updateParam('q', next.trim())
  }

  const clearAll = () => {
    setQueryValue('')
    startTransition(() => {
      router.push('/search')
    })
  }

  const hasActiveFilters = currentParams.category || currentParams.tier || currentParams.espanol

  const espanolActive = Boolean(currentParams.espanol)
  const toggleEspanol = () => updateParam('espanol', espanolActive ? '' : '1')

  // Deep-link support: /search?category=X arrives here with the category
  // set in the URL but the page rendered all categories. Scroll the
  // matching group into view once on mount.
  useEffect(() => {
    if (currentParams.category && typeof window !== 'undefined') {
      const id = window.requestAnimationFrame(() => {
        const el = document.getElementById(`cat-${currentParams.category}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      return () => window.cancelAnimationFrame(id)
    }
  }, [currentParams.category])

  return (
    <div className="flex flex-col gap-4">
      {/* Main search row */}
      <div className="flex gap-3 items-center">
        <div className="flex-1 relative">
          <Search
            className={cn(
              'absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none',
              isPending ? 'text-primary animate-pulse' : 'text-slate-400',
            )}
          />
          <input
            type="text"
            value={queryValue}
            onChange={(e) => {
              const next = e.target.value
              setQueryValue(next)
              // Auto-submit when the user deletes back to empty. Same UX as
              // /events SearchBar — prevents 'I cleared the search but
              // nothing happened' confusion.
              if (next === '' && (currentParams.q ?? '') !== '') submitQuery('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                submitQuery((e.target as HTMLInputElement).value)
                return
              }
              if (e.key === 'Escape') {
                if (queryValue) {
                  setQueryValue('')
                  submitQuery('')
                }
                ;(e.currentTarget as HTMLInputElement).blur()
              }
            }}
            placeholder="Search businesses by name, address, or category…"
            aria-label="Search businesses"
            className={cn(
              'w-full pl-10 pr-10 py-2.5 rounded-xl text-sm text-text placeholder:text-slate-400 bg-white/80 backdrop-blur border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors',
              isPending && 'opacity-60',
            )}
          />
          {queryValue && (
            <button
              type="button"
              onClick={() => submitQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-text hover:bg-slate-100 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mobile filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="md:hidden flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white/80 hover:bg-white transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary" />}
        </button>

        {/* Desktop filter row */}
                <div className="hidden md:flex items-center gap-3">
          {/* Category — kept as a select dropdown because once filtered to
              a single category the jump-to pills collapse, leaving the
              user without an escape hatch otherwise. */}
          <select
            value={currentParams.category || ''}
            onChange={(e) => updateParam('category', e.target.value)}
            className="input py-2.5 w-auto min-w-[180px] bg-white/80 backdrop-blur rounded-xl text-sm"
            aria-label="Filter to a single category"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Tier — segmented pill control (matches /events style) */}
          <div className="bg-slate-100/80 rounded-xl p-1 flex gap-1">
            {[
              { value: '', label: 'All' },
              { value: 'FEATURED', label: 'Featured' },
              { value: 'FREE', label: 'Free' },
              { value: 'CHAMBER', label: 'Chamber' },
            ].map((opt) => {
              const active = (currentParams.tier || '') === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => updateParam('tier', opt.value)}
                  aria-pressed={active}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap',
                    active
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-text-secondary hover:text-text',
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>

          {/* Language toggle — switch pill */}
          <button
            onClick={toggleEspanol}
            aria-pressed={espanolActive}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors whitespace-nowrap',
              espanolActive
                ? 'bg-primary border-primary text-white'
                : 'bg-white/80 border-slate-200 text-text-secondary hover:bg-white',
            )}
          >
            <Languages className="w-4 h-4" />
            En español
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-error hover:bg-white/80 transition-colors"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Mobile filter panel */}
      {showFilters && (
        <div className="md:hidden flex flex-col gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
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
          <button
            onClick={toggleEspanol}
            aria-pressed={espanolActive}
            className={cn(
              'flex items-center justify-center gap-1.5 px-4 py-3 rounded-lg border text-sm font-medium transition-colors',
              espanolActive
                ? 'bg-primary border-primary text-white'
                : 'bg-white border-slate-200 text-text-secondary',
            )}
          >
            <Languages className="w-4 h-4" />
            Se habla español
          </button>
          <select
            value={currentParams.tier || ''}
            onChange={(e) => updateParam('tier', e.target.value)}
            className="input"
            aria-label="Filter by listing tier"
          >
            <option value="">All Listings</option>
            <option value="FEATURED">Featured</option>
            <option value="FREE">Free</option>
            <option value="CHAMBER">Chamber</option>
          </select>
          {hasActiveFilters && (
            <button onClick={clearAll} className="text-sm text-error">
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Category jump-to pills — only show when there's at least one
          category with results. Pill style is now the same as the
          segmented tier control: muted by default, primary when active. */}
      {categoryNav.length > 1 && (
        <nav aria-label="Jump to category" className="flex flex-wrap gap-2 pt-1">
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
    </div>
  )
}