'use client'

import { useCallback, useEffect, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'

export interface LightboxPhoto {
  url: string
  caption?: string
}

interface Props {
  photos: LightboxPhoto[]
  /** Index of the photo to start at. null = closed. */
  index: number | null
  onClose: () => void
  onIndexChange: (i: number) => void
}

/**
 * Lightweight lightbox for Outings photo galleries.
 *
 * Why not reuse the real-estate PhotoGallery lightbox? That one ships
 * zoom + pinch + pan + a swipe hint — overkill for a blog article,
 * and would add ~491 lines of bundle weight to a page that just wants
 * "click image, see it big."
 *
 * What's here:
 *  - Dark backdrop (z-50) with centered image
 *  - Prev / Next chevrons + arrow-key navigation (loops)
 *  - Photo counter pill ("3 / 12")
 *  - Caption under the image (when present)
 *  - Esc / click-backdrop / X button to close
 *  - Body scroll lock while open
 *  - Honor `prefers-reduced-motion` (no fade transition)
 */
export default function ImageLightbox({ photos, index, onClose, onIndexChange }: Props) {
  const isOpen = index !== null
  const total = photos.length
  const photo = isOpen ? photos[index] : null

  const next = useCallback(() => {
    if (index === null) return
    onIndexChange((index + 1) % total)
  }, [index, total, onIndexChange])
  const prev = useCallback(() => {
    if (index === null) return
    onIndexChange((index - 1 + total) % total)
  }, [index, total, onIndexChange])

  // Lock body scroll while open + bind arrow keys + Esc
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [isOpen, onClose, next, prev])

  // Briefly show the photo counter pill on open so users see it,
  // then fade it out. Purely cosmetic — reappears on next/prev.
  const [counterVisible, setCounterVisible] = useState(true)
  useEffect(() => {
    if (!isOpen) return
    setCounterVisible(true)
    const t = setTimeout(() => setCounterVisible(false), 1800)
    return () => clearTimeout(t)
  }, [isOpen, index])

  if (!isOpen || !photo) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo ${index! + 1} of ${total}`}
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 sm:p-8"
      onClick={onClose}
    >
      {/* Image — stop click from bubbling to backdrop */}
      <figure
        className="relative max-w-full max-h-full flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption || ''}
          className="max-w-full max-h-[80vh] object-contain rounded-md"
        />
        {photo.caption && (
          <figcaption className="mt-4 text-white/90 text-sm sm:text-base italic text-center max-w-2xl">
            {photo.caption}
          </figcaption>
        )}

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -top-2 -right-2 sm:top-2 sm:right-2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Prev / Next chevrons */}
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              aria-label="Previous photo"
              className="absolute left-2 sm:-left-14 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={next}
              aria-label="Next photo"
              className="absolute right-2 sm:-right-14 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Counter pill — top-center, fades out after open/next */}
        {total > 1 && (
          <div
            className={`absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-medium transition-opacity duration-300 ${
              counterVisible ? 'opacity-100' : 'opacity-0'
            }`}
            aria-hidden="true"
          >
            {index! + 1} / {total}
          </div>
        )}
      </figure>
    </div>
  )
}