'use client'

import { useState } from 'react'
import ImageLightbox, { type LightboxPhoto } from './ImageLightbox'

interface Props {
  photos: LightboxPhoto[]
  title: string
}

/**
 * Photo gallery for the Outings article page.
 *
 * Layout:
 *  - First photo: large (16:9), full-width, sits as the visual hero of
 *    the gallery block
 *  - Remaining photos: square tiles in a 2/3-col responsive grid
 *  - Every thumbnail is a <button> that opens the lightbox at that index
 *
 * The lightbox is owned by this component so the server can render the
 * gallery HTML on initial paint (good for SEO and no-JS readers) while
 * the click-to-enlarge is a progressive enhancement.
 */
export default function OutingPhotoGallery({ photos, title }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  if (photos.length === 0) return null

  const [first, ...rest] = photos

  return (
    <>
      <div className="space-y-3">
        {/* Hero tile */}
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          aria-label={`Open ${first.caption || `photo 1`} in fullscreen`}
          className="block w-full aspect-[16/9] rounded-2xl overflow-hidden bg-slate-100 group relative"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={first.url}
            alt={first.caption || `${title} — photo 1`}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
          {first.caption && (
            <span className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent text-white text-sm italic text-left">
              {first.caption}
            </span>
          )}
        </button>

        {/* Remaining tiles */}
        {rest.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {rest.map((photo, i) => {
              const idx = i + 1
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setLightboxIndex(idx)}
                  aria-label={`Open photo ${idx + 1} in fullscreen`}
                  className="block aspect-square rounded-xl overflow-hidden bg-slate-100 group relative"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={photo.caption || `${title} — photo ${idx + 1}`}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </button>
              )
            })}
          </div>
        )}
      </div>

      <ImageLightbox
        photos={photos}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </>
  )
}