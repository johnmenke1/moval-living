'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'

/**
 * Events text-search bar. Updates ?q=... in the URL on submit (Enter)
 * or when the user clicks the clear-X. Mirrors the CategoryFilter /
 * LanguageFilter pattern: client component, reads + writes URL params
 * via useRouter so the server-rendered page is the source of truth
 * (and links stay shareable).
 *
 * Why no debounce: the page is server-rendered, so each keystroke
 * would trigger a re-fetch. Enter-on-submit is the standard pattern
 * for /search and feels right here.
 */
export default function SearchBar({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [value, setValue] = useState(initialQuery)

  // Keep the input in sync if the URL changes externally (e.g. clear
  // button on EmptyState, browser back/forward).
  useEffect(() => {
    setValue(initialQuery)
  }, [initialQuery])

  const submit = (next: string) => {
    const params = new URLSearchParams(searchParams.toString())
    const trimmed = next.trim()
    if (trimmed) {
      params.set('q', trimmed)
    } else {
      params.delete('q')
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <div className="relative max-w-md">
      <Search
        className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${
          isPending ? 'text-primary animate-pulse' : 'text-slate-400'
        }`}
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit(value)
        }}
        placeholder='Search events, e.g. "Ravens football"'
        aria-label="Search events"
        className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm text-text placeholder:text-slate-400 bg-white/80 backdrop-blur border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => submit('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-text hover:bg-slate-100 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}