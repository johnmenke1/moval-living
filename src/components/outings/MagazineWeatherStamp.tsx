'use client'

import { useEffect, useState } from 'react'

/**
 * Weather stamp — the "departure board" / departure-board-meets-forecaster
 * element in the masthead. Server-rendered with a placeholder timestamp, then
 * the client hydrates with the actual local date. We don't fetch real weather
 * (no API key, no third-party dep) — the temperature is a stable, hand-set
 * Moreno Valley late-summer reading. The signature is the format, not the data.
 */
export function MagazineWeatherStamp({ initialNow }: { initialNow: string }) {
  const [now, setNow] = useState(initialNow)

  useEffect(() => {
    setNow(new Date().toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }))
  }, [])

  return (
    <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/90 leading-6 text-right">
      <div className="border-r-2 border-accent pr-3 inline-block">
        <div className="text-white/50">Departing</div>
        <div className="text-white">Moreno Valley · 33.94°N</div>
      </div>
      <div className="mt-2 border-r-2 border-white/30 pr-3 inline-block">
        <div className="text-white/50">Arriving</div>
        <div className="text-accent">Anywhere</div>
      </div>
      <div className="mt-2 border-r-2 border-white/30 pr-3 inline-block">
        <div className="text-white/50">{now}</div>
        <div className="text-white">87°F · Clear</div>
      </div>
    </div>
  )
}
