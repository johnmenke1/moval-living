'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Home } from 'lucide-react'

interface PhotoGalleryProps {
  photos: string[]
  address: string
}

/**
 * Photo gallery for the listing detail page.
 *
 * Layout:
 *  - Main hero photo (clickable to open lightbox)
 *  - 4 thumbnail tiles (clickable to open lightbox at that index)
 *  - "View all N photos" button if there are more than 5
 *
 * Lightbox behavior:
 *  - Full-screen overlay (z-50) with the image centered
 *  - Left/right arrow keys + on-screen buttons to navigate
 *  - Esc closes
 *  - Click on backdrop (outside the image) closes
 *  - Body scroll locked while open
 *  - Photo counter (e.g. "3 / 12")
 */
export function PhotoGallery({ photos, address }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const open = (idx: number) => setLightboxIndex(idx)
  const close = useCallback(() => setLightboxIndex(null), [])

  const next = useCallback(() => {
    setLightboxIndex((cur) => (cur === null ? null : (cur + 1) % photos.length))
  }, [photos.length])
  const prev = useCallback(() => {
    setLightboxIndex((cur) =>
      cur === null ? null : (cur - 1 + photos.length) % photos.length,
    )
  }, [photos.length])

  // Keyboard navigation while lightbox is open
  useEffect(() => {
    if (lightboxIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxIndex, close, next, prev])

  // Lock body scroll while lightbox is open
  useEffect(() => {
    if (lightboxIndex === null) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [lightboxIndex])

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
          {/* Photo count pill on main image */}
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
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
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
            className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Photo counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/90 text-sm font-medium bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
            {lightboxIndex + 1} / {photos.length}
          </div>

          {/* Previous arrow */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                prev()
              }}
              aria-label="Previous photo"
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          {/* Next arrow */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                next()
              }}
              aria-label="Next photo"
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors backdrop-blur-sm"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

          {/* Main image — click stops propagation so clicking the image
              itself doesn't close the modal. */}
          <img
            key={lightboxIndex /* force re-render between photos */}
            src={photos[lightboxIndex]}
            alt={`${address} — photo ${lightboxIndex + 1}`}
            className="max-w-[95vw] max-h-[90vh] object-contain select-none"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}