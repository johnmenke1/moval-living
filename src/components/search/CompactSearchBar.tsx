'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Search, X, Languages } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * CompactSearchBar — search input + language toggle + clear-all.
 *
 * Used to live in a sticky bar BELOW the /search "header card" so it
 * stayed reachable while users scrolled listings. As of the /search hero
 * makeover (Aug 27), it's rendered INSIDE the photo hero instead, so the
 * sticky bar is gone and the hero is the single source of truth for
 * filtering /search.
 *
 * UX mirrors /events SearchBar: controlled input, Escape clears,
 * auto-submit on backspace-to-empty, custom clear-X. URL is the source of
 * truth (server-rendered page reads ?q=... and ?espanol=...).
 */
interface CompactSearchBarProps {
  currentParams: {
    q?: string
    espanol?: string
  }
  hasActiveFilters: boolean
}

export function CompactSearchBar({ currentParams, hasActiveFilters }: CompactSearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [queryValue, setQueryValue] = useState(currentParams.q ?? '')

  // Keep the input in sync if the URL changes externally (e.g. browser
  // back/forward, the Clear button below).
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

  const submitQuery = (next: string) => updateParam('q', next.trim())

  const espanolActive = Boolean(currentParams.espanol)
  const toggleEspanol = () => updateParam('espanol', espanolActive ? '' : '1')

  const clearAll = () => {
    setQueryValue('')
    startTransition(() => {
      router.push('/search')
    })
  }

  return (
    <div className="flex items-center gap-3">
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
            'w-full pl-10 pr-10 py-2.5 rounded-xl text-sm text-text placeholder:text-slate-400 bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors',
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

      {/* Language toggle — switch pill */}
      <button
        onClick={toggleEspanol}
        aria-pressed={espanolActive}
        className={cn(
          'flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors whitespace-nowrap',
          espanolActive
            ? 'bg-primary border-primary text-white'
            : 'bg-white border-slate-200 text-text-secondary hover:bg-slate-50',
        )}
      >
        <Languages className="w-4 h-4" />
        En español
      </button>

      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-error hover:bg-white transition-colors whitespace-nowrap"
        >
          <X className="w-4 h-4" />
          Clear
        </button>
      )}
    </div>
  )
}