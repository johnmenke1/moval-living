'use client'

import { useState } from 'react'
import { ZoomIn } from 'lucide-react'
import ImageLightbox from '@/app/outings/[slug]/ImageLightbox'

interface Props {
  imageUrl: string
  headline: string
  businessName: string
}

/**
 * Click-to-expand wrapper for a deal's uploaded promo image.
 *
 * Renders the deal image with a subtle "expand" affordance (cursor zoom +
 * corner ZoomIn badge) and opens the existing ImageLightbox on click.
 * Re-uses the Outings-gallery lightbox verbatim — it already handles
 * dark backdrop, Esc/backdrop close, body-scroll lock, and
 * prefers-reduced-motion. Build-as-client because both the click state
 * and the lightbox itself are interactive.
 *
 * Why a thin wrapper: the listing page is a Server Component that can't
 * hold useState. Lifting just this one piece to 'use client' is smaller
 * than promoting the whole deals section. The lightbox import pulls in
 * a small client-only bundle.
 */
export function DealImageLightbox({ imageUrl, headline, businessName }: Props) {
  const [index, setIndex] = useState<number | null>(null)

  return (
    <>
      <button
        type="button"
        onClick={() => setIndex(0)}
        aria-label={`View ${headline} — ${businessName} full size`}
        className="group relative w-full aspect-[16/9] bg-slate-100 overflow-hidden cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-md"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`${headline} — ${businessName}`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          loading="lazy"
        />
        {/* Subtle expand badge — corner overlay so it's obvious without
            overwhelming the deal artwork. Screen-reader users get the
            button's aria-label; sighted users get the cursor + icon. */}
        <span className="absolute top-4 left-4 flex items-center gap-1.5 bg-black/70 text-white text-xs font-medium px-2.5 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <ZoomIn className="w-3.5 h-3.5" />
          View full size
        </span>
      </button>

      <ImageLightbox
        photos={[{ url: imageUrl, caption: `${headline} — ${businessName}` }]}
        index={index}
        onClose={() => setIndex(null)}
        onIndexChange={setIndex}
      />
    </>
  )
}
