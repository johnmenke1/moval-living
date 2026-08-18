'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

// Small single-chip language filter. Renders next to CategoryFilter on the
// /events page. When active, only events with esEnEspanol=true are shown.
// The toggle is purely additive (it stacks with the category filter, not OR).
interface Props {
  active: boolean
}

export default function LanguageFilter({ active }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const toggle = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    if (active) {
      params.delete('lang')
    } else {
      params.set('lang', 'es')
    }
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, searchParams, active])

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary mr-1">
        Language
      </span>
      <button
        onClick={toggle}
        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
          active
            ? 'bg-primary text-white'
            : 'bg-slate-100 text-text-secondary hover:bg-slate-200'
        }`}
        aria-pressed={active}
      >
        En Español
      </button>
    </div>
  )
}