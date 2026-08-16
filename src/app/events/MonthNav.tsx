'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'

interface Props {
  /** Current month as "YYYY-MM-01" Date */
  currentMonth: Date
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatMonth(d: Date): string {
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

function shiftMonth(d: Date, delta: number): Date {
  const next = new Date(d)
  next.setUTCMonth(next.getUTCMonth() + delta)
  return next
}

export default function MonthNav({ currentMonth }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const navigate = useCallback(
    (newMonth: Date) => {
      const params = new URLSearchParams(searchParams.toString())
      const yyyy = newMonth.getUTCFullYear()
      const mm = String(newMonth.getUTCMonth() + 1).padStart(2, '0')
      params.set('view', 'month')
      params.set('month', `${yyyy}-${mm}`)
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const goPrev = useCallback(() => navigate(shiftMonth(currentMonth, -1)), [navigate, currentMonth])
  const goNext = useCallback(() => navigate(shiftMonth(currentMonth, 1)), [navigate, currentMonth])

  // Swipe handling
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }
  const onTouchEnd = () => {
    if (touchStart === null || touchEnd === null) return
    const distance = touchStart - touchEnd
    const minSwipe = 50
    if (distance > minSwipe) goNext()    // swiped left → next month
    if (distance < -minSwipe) goPrev()  // swiped right → prev month
  }

  // Mouse drag for desktop swipe
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let mouseStart: number | null = null
    const onMouseDown = (e: MouseEvent) => { mouseStart = e.clientX }
    const onMouseUp = (e: MouseEvent) => {
      if (mouseStart === null) return
      const dist = mouseStart - e.clientX
      if (dist > 80) goNext()
      if (dist < -80) goPrev()
      mouseStart = null
    }
    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('mouseup', onMouseUp)
    return () => {
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('mouseup', onMouseUp)
    }
  }, [goNext, goPrev])

  // Month picker: render a grid of months in current year + prev/next year
  const pickerYear = currentMonth.getUTCFullYear()
  const pickerYears = [pickerYear - 1, pickerYear, pickerYear + 1]
  const [pickerYearState, setPickerYearState] = useState(pickerYear)

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="flex items-center justify-center gap-3 select-none"
    >
      <button
        onClick={goPrev}
        aria-label="Previous month"
        className="p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
      >
        <ChevronLeft className="w-5 h-5 text-text" />
      </button>

      <div className="relative">
        <button
          onClick={() => setPickerOpen((o) => !o)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 hover:border-primary/40 font-semibold text-text"
        >
          <CalendarIcon className="w-4 h-4 text-primary" />
          <span className="min-w-[8rem] text-center">{formatMonth(currentMonth)}</span>
        </button>

        {pickerOpen && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-20 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 w-80">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setPickerYearState((y) => y - 1)}
                className="p-1 rounded hover:bg-slate-100"
                aria-label="Previous year"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-text">{pickerYearState}</span>
              <button
                onClick={() => setPickerYearState((y) => y + 1)}
                className="p-1 rounded hover:bg-slate-100"
                aria-label="Next year"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {MONTH_NAMES.map((name, idx) => {
                const isCurrent =
                  pickerYearState === currentMonth.getUTCFullYear() &&
                  idx === currentMonth.getUTCMonth()
                return (
                  <button
                    key={name}
                    onClick={() => {
                      navigate(new Date(Date.UTC(pickerYearState, idx, 1)))
                      setPickerOpen(false)
                    }}
                    className={`px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isCurrent
                        ? 'bg-primary text-white'
                        : 'hover:bg-slate-100 text-text'
                    }`}
                  >
                    {name.slice(0, 3)}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={goNext}
        aria-label="Next month"
        className="p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
      >
        <ChevronRight className="w-5 h-5 text-text" />
      </button>
    </div>
  )
}
