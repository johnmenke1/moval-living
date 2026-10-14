'use client'

import { useEffect, useState } from 'react'

export function Countdown({ target, label }: { target: string; label: string }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    // Client-only clock so server and client HTML match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  if (now === null) return <div className="h-[72px]" />
  const ms = Math.max(0, Date.parse(target) - now)
  const d = Math.floor(ms / 86_400_000)
  const h = Math.floor((ms % 86_400_000) / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const s = Math.floor((ms % 60_000) / 1000)
  const cell = (v: number, l: string) => (
    <div className="rounded-xl bg-black/40 border border-[#3a1d57] px-3 py-2 min-w-[64px] text-center">
      <div className="text-2xl font-bold text-orange-300 tabular-nums">{String(v).padStart(2, '0')}</div>
      <div className="text-xs uppercase tracking-wider text-purple-200/70">{l}</div>
    </div>
  )
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-purple-200/70 mb-2">{label}</p>
      <div className="flex gap-2">{cell(d, 'days')}{cell(h, 'hrs')}{cell(m, 'min')}{cell(s, 'sec')}</div>
    </div>
  )
}
