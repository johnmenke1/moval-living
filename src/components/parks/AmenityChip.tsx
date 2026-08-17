'use client'

import { cn } from '@/lib/utils'

interface AmenityChipProps {
  /** Either the slug or the human label — children overrides label. */
  slug: string
  label?: string
  icon?: string
  /** Visual state. Active = filled, inactive = outlined. */
  active?: boolean
  count?: number
  onToggle?: () => void
  className?: string
}

/**
 * AmenityChip — single-amenity pill used in two places:
 *
 *   1. Filter bar (multi-select toggle, fill state)
 *   2. Park card row (read-only inline display)
 *
 * Pass `onToggle` to make it interactive (filter chips); omit it for
 * read-only usage (park cards).
 */
export function AmenityChip({
  slug,
  label,
  icon,
  active = false,
  count,
  onToggle,
  className,
}: AmenityChipProps) {
  const interactive = typeof onToggle === 'function'
  const base = active
    ? 'bg-primary text-white border-primary'
    : 'bg-white text-text-secondary border-slate-200 hover:border-slate-300 hover:bg-slate-50'
  const stateStyles = interactive
    ? 'cursor-pointer transition-colors active:scale-95'
    : 'cursor-default'

  return (
    <button
      type={interactive ? 'button' : undefined}
      onClick={onToggle}
      disabled={!interactive}
      aria-pressed={interactive ? active : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium',
        base,
        stateStyles,
        className,
      )}
    >
      <span>{label ?? slug.replace(/_/g, ' ')}</span>
      {typeof count === 'number' && (
        <span
          className={cn(
            'ml-0.5 inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 rounded-full text-[10px] font-bold',
            active ? 'bg-white/20 text-white' : 'bg-slate-100 text-text-secondary',
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}
