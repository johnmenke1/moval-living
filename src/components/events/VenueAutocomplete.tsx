'use client'

import { useEffect, useRef, useState } from 'react'
import { Building2, MapPin, Loader2 } from 'lucide-react'

export type VenueOption = {
  id: string
  slug: string
  name: string
  org: string | null
  address: string
  city: string
  state: string
  zip: string
}

type Props = {
  /** Current venueName text in the form (free text — what the user typed) */
  value: string
  /** Called when the user types or selects from the dropdown */
  onChange: (next: { venueName: string; venueId: string | null; address?: string; city?: string; state?: string; zip?: string }) => void
  /** Optional: when a Venue is picked, copy these fields to the parent form */
  onPick?: (v: VenueOption) => void
}

const DEBOUNCE_MS = 150

/**
 * Venue autocomplete. Combines:
 *   1. A free-text field (what the user is typing)
 *   2. A dropdown of matching canonical Venue rows from /api/venues
 *   3. When the user picks one, fills address / city / state / zip via
 *      the onPick callback. The user can still edit those fields after.
 *
 * Falls back gracefully: if /api/venues is unreachable, the field just
 * stays a plain text input.
 */
export default function VenueAutocomplete({ value, onChange, onPick }: Props) {
  const [query, setQuery] = useState(value)
  const [options, setOptions] = useState<VenueOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const [pickedVenueId, setPickedVenueId] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const lastFetched = useRef('')

  // Sync external value -> internal query (e.g. when form resets)
  useEffect(() => { setQuery(value) }, [value])

  // Click-outside to close dropdown
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Debounced fetch as user types
  useEffect(() => {
    const t = setTimeout(async () => {
      const url = `/api/venues?q=${encodeURIComponent(query)}`
      if (lastFetched.current === url) return
      lastFetched.current = url
      setLoading(true)
      try {
        const res = await fetch(url)
        if (!res.ok) {
          setOptions([])
        } else {
          const data = (await res.json()) as { venues: VenueOption[] }
          setOptions(data.venues ?? [])
        }
      } catch {
        setOptions([])
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  function pick(v: VenueOption) {
    setQuery(v.name)
    setOpen(false)
    setPickedVenueId(v.id)
    onChange({
      venueName: v.name,
      venueId: v.id,
    })
    onPick?.(v)
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value
    setQuery(next)
    setOpen(true)
    setHighlight(-1)
    // User is editing free text — clear venueId so we don't lie about
    // having a linked canonical venue. onPick will re-set it when they
    // choose from the dropdown.
    if (pickedVenueId) setPickedVenueId(null)
    onChange({ venueName: next, venueId: null })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => Math.min(h + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlight >= 0 && highlight < options.length) {
      e.preventDefault()
      pick(options[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showDropdown = open && (options.length > 0 || loading)

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={onInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Type to search venues (e.g. Fox, Canyon Springs, MV College)"
          autoComplete="off"
          maxLength={200}
          className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}
      </div>
      {showDropdown && (
        <div className="absolute z-20 mt-1 left-0 right-0 max-h-72 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-lg">
          {options.length === 0 && !loading && (
            <div className="px-4 py-3 text-sm text-text-secondary">
              No matching venues. Type a custom name above and we'll save it as-is.
            </div>
          )}
          {options.map((v, i) => (
            <button
              key={v.id}
              type="button"
              onClick={() => pick(v)}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-4 py-2.5 flex items-start gap-2 hover:bg-slate-50 ${
                highlight === i ? 'bg-slate-50' : ''
              }`}
            >
              <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-sm text-text truncate">{v.name}</div>
                <div className="text-xs text-text-secondary truncate">
                  {v.address}, {v.city} {v.zip}
                </div>
                {v.org && v.org !== v.name && (
                  <div className="text-xs text-text-secondary/70 truncate">{v.org}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
