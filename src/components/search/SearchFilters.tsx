'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchFiltersProps {
  categories: Array<{ id: string; name: string; slug: string }>
  currentParams: {
    q?: string
    category?: string
    tier?: string
    sort?: string
  }
  resultCount: number
}

export function SearchFilters({ categories, currentParams, resultCount }: SearchFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [showFilters, setShowFilters] = useState(false)

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    params.delete('page') // Reset to page 1 on filter change
    startTransition(() => {
      router.push(`/search?${params.toString()}`)
    })
  }

  const clearAll = () => {
    startTransition(() => {
      router.push('/search')
    })
  }

  const hasActiveFilters = currentParams.category || currentParams.tier || currentParams.sort

  return (
    <div className="flex flex-col gap-4">
      {/* Main search row */}
      <div className="flex gap-3 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            defaultValue={currentParams.q}
            placeholder="Search businesses..."
            className={cn('input pl-12', isPending && 'opacity-60')}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const value = (e.target as HTMLInputElement).value
                updateParam('q', value)
              }
            }}
          />
        </div>

        {/* Mobile filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="md:hidden flex items-center gap-2 px-4 py-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-primary" />
          )}
        </button>

        {/* Desktop filter row */}
        <div className="hidden md:flex items-center gap-3">
          <select
            value={currentParams.category || ''}
            onChange={e => updateParam('category', e.target.value)}
            className="input py-3 w-auto min-w-[180px]"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.slug}>{cat.name}</option>
            ))}
          </select>

          <select
            value={currentParams.tier || ''}
            onChange={e => updateParam('tier', e.target.value)}
            className="input py-3 w-auto min-w-[140px]"
          >
            <option value="">All Listings</option>
            <option value="FEATURED">Featured Only</option>
            <option value="FREE">Free Only</option>
          </select>

          <select
            value={currentParams.sort || ''}
            onChange={e => updateParam('sort', e.target.value)}
            className="input py-3 w-auto min-w-[160px]"
          >
            <option value="">Newest First</option>
            <option value="rating">Highest Rated</option>
            <option value="name">A to Z</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearAll}
              className="text-sm text-text-secondary hover:text-error flex items-center gap-1 transition-colors"
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
            onChange={e => updateParam('category', e.target.value)}
            className="input"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.slug}>{cat.name}</option>
            ))}
          </select>
          <div className="flex gap-3">
            <select
              value={currentParams.tier || ''}
              onChange={e => updateParam('tier', e.target.value)}
              className="input flex-1"
            >
              <option value="">All Listings</option>
              <option value="FEATURED">Featured Only</option>
            </select>
            <select
              value={currentParams.sort || ''}
              onChange={e => updateParam('sort', e.target.value)}
              className="input flex-1"
            >
              <option value="">Newest</option>
              <option value="rating">Top Rated</option>
              <option value="name">A–Z</option>
            </select>
          </div>
          {hasActiveFilters && (
            <button onClick={clearAll} className="text-sm text-error">
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}
