'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

export const CATEGORIES = [
  { value: 'HS_SPORTS', label: 'HS Sports' },
  { value: 'COLLEGE_SPORTS', label: 'College Sports' },
  { value: 'LEAGUE_SPORTS', label: 'League Sports' },
  { value: 'POLITICAL', label: 'Political' },
  { value: 'MUSIC', label: 'Music' },
  { value: 'ARTS', label: 'Arts & Culture' },
  { value: 'EDUCATIONAL', label: 'Education' },
  { value: 'FAMILY', label: 'Family / Kids' },
  { value: 'FOOD_DRINK', label: 'Food & Drink' },
  { value: 'COMMUNITY', label: 'Community / Volunteer' },
  { value: 'FUNDRAISERS', label: 'Fundraisers' },
  { value: 'HOLIDAY_CELEBRATIONS', label: 'Holiday / Celebrations' },
] as const

interface Props {
  selected: string[]
}

export default function CategoryFilter({ selected }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const toggle = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      const set = new Set(selected)
      if (set.has(value)) {
        set.delete(value)
      } else {
        set.add(value)
      }
      const next = Array.from(set)
      if (next.length === 0) {
        params.delete('cat')
      } else {
        params.set('cat', next.join(','))
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams, selected],
  )

  const clear = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('cat')
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary mr-1">
        Filters
      </span>
      {CATEGORIES.map((cat) => {
        const isActive = selected.includes(cat.value)
        return (
          <button
            key={cat.value}
            onClick={() => toggle(cat.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              isActive
                ? 'bg-primary text-white'
                : 'bg-slate-100 text-text-secondary hover:bg-slate-200'
            }`}
            aria-pressed={isActive}
          >
            {cat.label}
          </button>
        )
      })}
      {selected.length > 0 && (
        <button
          onClick={clear}
          className="px-2 py-1 text-xs font-semibold text-text-secondary underline hover:text-text"
        >
          Clear
        </button>
      )}
    </div>
  )
}
