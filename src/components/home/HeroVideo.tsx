'use client'

/**
 * HeroVideo — homepage hero background video with graceful degradation.
 *
 * Architecture (designed 2026-08-27 with the drone aerial hero video,
 * z-index trap fixed 2026-08-27 after Johnny flagged the gradient + blob
 * overlays disappeared once the video mounted):
 *
 *   ┌─ <picture> wraps the poster JPG ─────┐
 *   │  • Always renders, never blocked │
 *   │  • This IS the LCP element       │
 *   │  • fetchPriority="high"          │
 *   ├─ <video> overlays the poster ───┤
 *   │  • Hidden via opacity until JS   │
 *   │    confirms safe-to-autoplay:    │
 *   │    no prefers-reduced-motion,    │
 *   │    no save-data header, mobile   │
 *   │    connection (4g ok, 3g skip)   │
 *   │  • WebM first, MP4 fallback      │
 *   │  • muted + playsInline + loop    │
 *   │  • preload="metadata" so we know │
 *   │    width/duration without paying │
 *   │    the full payload             │
 *   │  • NO z-index — DOM order keeps  │
 *   │    it BELOW the gradient + blobs │
 *   │    that HomePageClient renders   │
 *   │    after <HeroVideo> in the     │
 *   │    same <section>               │
 *   └─ Crossfade when video plays ────┘
 *
 * On the server side, <picture> + <video> render with the poster; on
 * hydration the effect attaches and the video fades in if conditions
 * allow. If JS never loads (rare), the visitor still sees the poster.
 *
 * The video is autoplay-only AFTER hydration AND after the connection
 * check — never on a slow connection or a user with reduced-motion.
 */

import { useEffect, useRef, useState } from 'react'

export interface HeroVideoProps {
  /** Static poster JPG — the LCP image. Always renders. */
  posterSrc: string
  posterAlt: string
  /** WebM preferred. */
  webmSrc: string
  /** MP4 fallback for Safari < 16 and other WebM-less browsers. */
  mp4Src: string
  /** Tailwind/object classes applied to both <picture> and <video>. */
  className?: string
}

/**
 * navigator.connection.effectiveType — slow on 2g/3g. We treat '4g' as
 * the floor; users on 'slow-2g' / '2g' / '3g' get the poster only.
 * Browsers without the API (Firefox, older Safari) default to true
 * (play the video).
 */
function shouldAutoplay(): boolean {
  if (typeof window === 'undefined') return false
  // Respect OS-level reduced-motion
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) return false
  // Respect Save-Data header / client hint
  const conn = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string }
  }).connection
  if (conn?.saveData) return false
  if (conn?.effectiveType && ['slow-2g', '2g', '3g'].includes(conn.effectiveType)) {
    return false
  }
  return true
}

export function HeroVideo({
  posterSrc,
  posterAlt,
  webmSrc,
  mp4Src,
  className = 'absolute inset-0 w-full h-full object-cover',
}: HeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  // Default to true on the server render so SSR HTML matches the
  // un-hydrated first paint; the effect flips it on mount.
  // We render BOTH the poster and the video with `opacity-100` initially
  // to avoid any flash, then conditionally overlay the video via
  // absolute positioning with z-index.
  const [videoOn, setVideoOn] = useState(false)
  const [videoReady, setVideoReady] = useState(false)

  useEffect(() => {
    setVideoOn(shouldAutoplay())
  }, [])

  // Once the video has loaded enough metadata to play, fade it in
  // over the poster. Avoids a half-loaded frame showing through.
  const handleCanPlay = () => setVideoReady(true)

  return (
    <>
      {/* Poster — always the LCP element, never blocked. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={posterSrc}
        alt={posterAlt}
        className={className}
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />

      {/* Video overlay — only mounted if JS decides it's safe.
          Sits above the poster with opacity-0 until first canplay event,
          then fades in. DOM order keeps it BELOW the gradient + blob
          overlays that follow it in HomePageClient's <section> — no
          z-index needed because every layer in the hero stack is
          `position: absolute` without an explicit z-index. */}
      {videoOn && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={posterSrc}
          onCanPlay={handleCanPlay}
          aria-hidden="true"
          className={`${className} transition-opacity duration-700 ${
            videoReady ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* WebM first — modern browsers prefer it. */}
          <source src={webmSrc} type="video/webm" />
          {/* MP4 fallback — Safari < 16 and other WebM-less browsers. */}
          <source src={mp4Src} type="video/mp4" />
        </video>
      )}
    </>
  )
}
