'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Home, ZoomIn, ZoomOut, RotateCcw, Hand } from 'lucide-react'

interface PhotoGalleryProps {
  photos: string[]
  address: string
}

const MIN_ZOOM = 1
const MAX_ZOOM = 4
const SWIPE_THRESHOLD = 50 // px of horizontal travel to count as a swipe
const SWIPE_DOWN_TO_CLOSE_THRESHOLD = 80 // px of downward vertical travel

/**
 * Photo gallery for the listing detail page.
 *
 * Layout:
 *  - Main hero photo (clickable to open lightbox)
 *  - 4 thumbnail tiles (clickable to open lightbox at that index)
 *  - "+N more" overlay on the last thumbnail when there are more than 5
 *
 * Lightbox behavior:
 *  - Full-screen overlay (z-50) with the image centered
 *  - Arrow keys + on-screen buttons to navigate between photos
 *  - Esc closes; click on backdrop closes
 *  - Touch swipe left/right to navigate (when not zoomed)
 *  - Touch swipe down to close (when not zoomed)
 *  - Pinch with two fingers to zoom (1x–4x); drag with one finger to pan
 *    while zoomed
 *  - Ctrl/Cmd + scroll wheel to zoom on desktop
 *  - Photo counter pill (e.g. "3 / 12")
 *  - Zoom controls: +/- buttons + reset, in the top-right corner
 *  - Body scroll locked while open
 */
export function PhotoGallery({ photos, address }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  // ─── Swipe hint ───────────────────────────────────────────────────
  //
  // Mobile/tablet users see a small "swipe to navigate / pinch to zoom"
  // overlay the first time they open the lightbox. It auto-dismisses
  // when they perform either gesture (or any zoom action). We gate the
  // hint itself behind a coarse-pointer media query so desktop users
  // never see it — they have a mouse, keyboard, and on-screen arrows.
  const [showSwipeHint, setShowSwipeHint] = useState(false)
  const [swipeHintFadingOut, setSwipeHintFadingOut] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const isCoarse = window.matchMedia('(pointer: coarse)').matches
    setShowSwipeHint(isCoarse)
    setSwipeHintFadingOut(false)
  }, [lightboxIndex])

  // Helper that dismisses the hint with a brief fade. Triggered once
  // per lightbox open.
  const dismissSwipeHint = useCallback(() => {
    setSwipeHintFadingOut(true)
    setTimeout(() => {
      setShowSwipeHint(false)
      setSwipeHintFadingOut(false)
    }, 350)
  }, [])

  const open = (idx: number) => setLightboxIndex(idx)
  const close = useCallback(() => setLightboxIndex(null), [])

  const next = useCallback(() => {
    dismissSwipeHint()
    setLightboxIndex((cur) => (cur === null ? null : (cur + 1) % photos.length))
  }, [photos.length, dismissSwipeHint])
  const prev = useCallback(() => {
    dismissSwipeHint()
    setLightboxIndex((cur) =>
      cur === null ? null : (cur - 1 + photos.length) % photos.length,
    )
  }, [photos.length, dismissSwipeHint])

  // ─── Zoom & pan state ─────────────────────────────────────────────
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })

  const resetZoom = useCallback(() => {
    dismissSwipeHint()
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [dismissSwipeHint])

  // Reset zoom whenever the displayed photo changes
  useEffect(() => {
    resetZoom()
  }, [lightboxIndex, resetZoom])

  const zoomIn = useCallback(() => {
    dismissSwipeHint()
    setZoom((z) => Math.min(MAX_ZOOM, z + 0.5))
  }, [dismissSwipeHint])
  const zoomOut = useCallback(
    () =>
      setZoom((z) => {
        dismissSwipeHint()
        const next_ = Math.max(MIN_ZOOM, z - 0.5)
        // Snap back to centered when fully zoomed out
        if (next_ === 1) setPan({ x: 0, y: 0 })
        return next_
      }),
    [dismissSwipeHint],
  )

  // ─── Keyboard navigation while lightbox is open ───────────────────
  useEffect(() => {
    if (lightboxIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === '+' || e.key === '=') zoomIn()
      else if (e.key === '-' || e.key === '_') zoomOut()
      else if (e.key === '0') resetZoom()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, close, next, prev, zoomIn, zoomOut, resetZoom])

  // ─── Lock body scroll while lightbox is open ──────────────────────
  useEffect(() => {
    if (lightboxIndex === null) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [lightboxIndex])

  // ─── Multi-touch gestures ─────────────────────────────────────────
  //
  // The three gesture types we need to distinguish:
  //   1. ONE-FINGER SWIPE (horizontal, unzoomed)  → next/prev photo
  //   2. ONE-FINGER DRAG (zoomed)                 → pan the image
  //   3. TWO-FINGER PINCH                         → zoom in/out
  //
  // We track these via a single useRef'd gesture object that survives
  // across touchstart/touchmove/touchend events.
  const gestureRef = useRef<{
    // Pinch state
    initialDistance: number | null
    initialZoom: number
    initialPan: { x: number; y: number }
    pinchCenter: { x: number; y: number } | null
    // Swipe state (one finger)
    swipeStartX: number | null
    swipeStartY: number | null
    // Pan state (one finger while zoomed)
    panStartX: number | null
    panStartY: number | null
    panOrigin: { x: number; y: number } | null
  }>({
    initialDistance: null,
    initialZoom: 1,
    initialPan: { x: 0, y: 0 },
    pinchCenter: null,
    swipeStartX: null,
    swipeStartY: null,
    panStartX: null,
    panStartY: null,
    panOrigin: null,
  })

  const distance = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Start a pinch — record current distance + zoom for ratio math
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      gestureRef.current.initialDistance = distance(t1, t2)
      gestureRef.current.initialZoom = zoom
      gestureRef.current.initialPan = { ...pan }
      gestureRef.current.pinchCenter = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      }
      gestureRef.current.swipeStartX = null
      gestureRef.current.panStartX = null
    } else if (e.touches.length === 1) {
      const t = e.touches[0]
      if (zoom > 1) {
        // Start a pan
        gestureRef.current.panStartX = t.clientX
        gestureRef.current.panStartY = t.clientY
        gestureRef.current.panOrigin = { ...pan }
        gestureRef.current.swipeStartX = null
      } else {
        // Start a swipe candidate
        gestureRef.current.swipeStartX = t.clientX
        gestureRef.current.swipeStartY = t.clientY
        gestureRef.current.panStartX = null
      }
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const g = gestureRef.current
    if (e.touches.length === 2 && g.initialDistance !== null) {
      // Pinch zoom — ratio = current distance / initial distance
      e.preventDefault() // stop native page-zoom
      // First pinch dismisses the hint
      if (zoom === 1) dismissSwipeHint()
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const ratio = distance(t1, t2) / g.initialDistance
      const newZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, g.initialZoom * ratio),
      )
      setZoom(newZoom)
      // If zoom snapped back to 1, clear pan so reset looks clean
      if (newZoom === 1) setPan({ x: 0, y: 0 })
    } else if (
      e.touches.length === 1 &&
      g.panStartX !== null &&
      g.panStartY !== null &&
      g.panOrigin
    ) {
      // Pan while zoomed
      e.preventDefault()
      const t = e.touches[0]
      const dx = t.clientX - g.panStartX
      const dy = t.clientY - g.panStartY
      setPan({ x: g.panOrigin.x + dx, y: g.panOrigin.y + dy })
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const g = gestureRef.current
    // If we were pinching and a finger lifted, finish the pinch cleanly
    if (g.initialDistance !== null && e.touches.length < 2) {
      g.initialDistance = null
      g.pinchCenter = null
      return
    }
    // Swipe completion — only fires on the final touchend when we were
    // tracking a swipe (not a pan or pinch).
    if (g.swipeStartX !== null && e.changedTouches.length === 1) {
      const deltaX = e.changedTouches[0].clientX - g.swipeStartX
      const deltaY = e.changedTouches[0].clientY - (g.swipeStartY ?? 0)
      // Vertical-only downward swipe → close the lightbox (mobile UX
      // convention; matches Instagram, Twitter, etc). Horizontal swipe
      // → next/prev as before.
      if (
        deltaY > SWIPE_DOWN_TO_CLOSE_THRESHOLD &&
        Math.abs(deltaY) > Math.abs(deltaX)
      ) {
        close()
      } else if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) next()
        else prev()
      }
      g.swipeStartX = null
      g.swipeStartY = null
    }
    if (g.panStartX !== null && g.panStartY !== null && e.touches.length === 0) {
      g.panStartX = null
      g.panStartY = null
      g.panOrigin = null
    }
  }

  // ─── Wheel zoom on desktop (Ctrl/Cmd + scroll) ────────────────────
  const handleWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    if (e.deltaY < 0) zoomIn()
    else zoomOut()
  }

  // ─── Render ────────────────────────────────────────────────────────
  if (photos.length === 0) {
    return (
      <div className="w-full h-72 bg-slate-100 flex items-center justify-center">
        <Home className="w-12 h-12 text-slate-300" />
      </div>
    )
  }

  const visibleThumbs = photos.slice(1, 5)
  const hasMore = photos.length > 5

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-4 grid-rows-2 gap-1 p-1">
        {/* Main large photo */}
        <button
          type="button"
          onClick={() => open(0)}
          aria-label="Open photo gallery"
          className="md:col-span-2 md:row-span-2 relative aspect-square md:aspect-auto overflow-hidden rounded-xl group cursor-pointer block w-full"
        >
          <img
            src={photos[0]}
            alt={`${address} — photo 1`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {photos.length > 1 && (
            <span className="absolute bottom-3 right-3 bg-black/70 text-white text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
              1 / {photos.length}
            </span>
          )}
        </button>

        {/* Thumbnail grid */}
        {visibleThumbs.map((url, i) => {
          const realIndex = i + 1
          const isLastVisible = i === visibleThumbs.length - 1 && hasMore
          return (
            <button
              key={realIndex}
              type="button"
              onClick={() => open(realIndex)}
              aria-label={`View photo ${realIndex + 1}`}
              className="relative aspect-square overflow-hidden rounded-xl hidden md:block group cursor-pointer"
            >
              <img
                src={url}
                alt={`${address} — photo ${realIndex + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {isLastVisible && (
                <span className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-semibold text-sm group-hover:bg-black/60 transition-colors">
                  +{photos.length - 5} more
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Lightbox overlay */}
      {lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${lightboxIndex + 1} of ${photos.length}`}
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center overflow-hidden"
          onClick={close}
        >
          {/* Close button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              close()
            }}
            aria-label="Close gallery"
            className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Photo counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/90 text-sm font-medium bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm z-20">
            {lightboxIndex + 1} / {photos.length}
          </div>

          {/* First-time swipe hint — only renders on touch devices and
              fades out the moment the user pinches or swipes. */}
          {showSwipeHint && (
            <div
              className={`absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none transition-opacity duration-300 ${
                swipeHintFadingOut ? 'opacity-0' : 'opacity-100'
              }`}
              role="status"
              aria-live="polite"
            >
              <div className="flex flex-col items-center gap-1 bg-black/60 text-white text-xs font-medium px-4 py-2.5 rounded-2xl backdrop-blur-sm shadow-lg">
                <span className="flex items-center gap-2">
                  <ChevronLeft className="w-4 h-4" />
                  <Hand className="w-4 h-4" />
                  <ChevronRight className="w-4 h-4" />
                  <span>Swipe to navigate · Pinch to zoom</span>
                </span>
                <span className="text-white/70 text-[10px] uppercase tracking-wide">
                  Swipe down to close
                </span>
              </div>
            </div>
          )}

          {/* Zoom controls — bottom center on touch, top-right stack on desktop */}
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-black/40 rounded-full p-1 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out"
              className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-white/90 text-xs font-medium tabular-nums px-2 min-w-[3.5rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in"
              className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={resetZoom}
              disabled={zoom === 1 && pan.x === 0 && pan.y === 0}
              aria-label="Reset zoom"
              className="w-9 h-9 rounded-full flex items-center justify-center text-white hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Previous arrow */}
          {photos.length > 1 && zoom === 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                prev()
              }}
              aria-label="Previous photo"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next arrow */}
          {photos.length > 1 && zoom === 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                next()
              }}
              aria-label="Next photo"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Main image — transform on the wrapper so panning has clear bounds.
              Click stops propagation so clicking the image itself doesn't
              close the modal. Touch/wheel events drive zoom/pan/swipe. */}
          <div
            className="select-none touch-none"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
            style={{
              // CSS transition on transform makes reset feel smooth, but is
              // disabled during an active gesture (no jarring lag)
              transition:
                gestureRef.current.initialDistance !== null
                  ? 'none'
                  : 'transform 200ms ease-out',
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              cursor: zoom > 1 ? 'grab' : 'default',
            }}
          >
            <img
              key={lightboxIndex /* force re-render between photos */}
              src={photos[lightboxIndex]}
              alt={`${address} — photo ${lightboxIndex + 1}`}
              className="max-w-[95vw] max-h-[90vh] object-contain"
              draggable={false}
            />
          </div>
        </div>
      )}
    </>
  )
}