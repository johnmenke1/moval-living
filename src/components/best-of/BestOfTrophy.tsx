'use client'

import { useId } from 'react'

export function BestOfTrophy({ className = '' }: { className?: string }) {
  const id = useId()
  const goldId = `best-of-gold-${id}`
  const sideId = `best-of-gold-side-${id}`

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="40%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id={sideId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
      </defs>
      <path
        d="M50 6 L62 34 L92 34 L68 52 L77 82 L50 65 L23 82 L32 52 L8 34 L38 34 Z"
        fill={`url(#${goldId})`}
        stroke="#fff"
        strokeWidth="1.5"
      />
      <rect x="43" y="78" width="14" height="10" rx="2" fill={`url(#${sideId})`} />
      <rect x="36" y="88" width="28" height="7" rx="2" fill="#92400e" />
    </svg>
  )
}
