'use client'

import { Suspense } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import CategoryFilter from './CategoryFilter'
import LanguageFilter from './LanguageFilter'

const VIEWS = [
  { value: 'today', label: 'Today' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'Month' },
] as const

type View = 'today' | 'weekend' | 'week' | 'month'

interface SearchInputProps {
  initialQuery: string
}

function SearchInput({ initialQuery }: SearchInputProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="relative max-w-xs">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        type="text"
        defaultValue={initialQuery}
        onKeyDown={(e) => {
          if (e.key === 'Enter') setParam('q', e.currentTarget.value)
          if (e.key === 'Escape') {
            e.currentTarget.value = ''
            setParam('q', null)
          }
        }}
        onBlur={(e) => setParam('q', e.target.value)}
        placeholder='Search events...'
        aria-label="Search events"
        className="w-full pl-10 pr-9 py-2 rounded-lg text-sm text-text placeholder:text-slate-400 bg-slate-100 border-transparent focus:bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
      />
      {initialQuery && (
        <button
          type="button"
          onClick={() => setParam('q', null)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-text"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

function ViewTabs({ view }: { view: View }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setView = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'month') {
      params.delete('view')
    } else {
      params.set('view', value)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
      {VIEWS.map(({ value, label }) => {
        const active = view === value
        return (
          <button
            key={value}
            type="button"
            onClick={() => setView(value)}
            className={[
              'px-3.5 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors',
              active
                ? 'bg-primary text-white shadow-sm'
                : 'text-text-secondary hover:text-text hover:bg-slate-200/70',
            ].join(' ')}
            aria-pressed={active}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

interface EventsToolbarProps {
  view: View
  searchQuery: string
  selectedCats: string[]
  langEs: boolean
}

export default function EventsToolbar({ view, searchQuery, selectedCats, langEs }: EventsToolbarProps) {
  return (
    <div className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="container-max py-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <ViewTabs view={view} />
          <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <SearchInput initialQuery={searchQuery} />
            <Suspense fallback={null}>
              <CategoryFilter selected={selectedCats} />
            </Suspense>
            <Suspense fallback={null}>
              <LanguageFilter active={langEs} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}
