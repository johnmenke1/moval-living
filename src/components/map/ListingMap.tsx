'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, ExternalLink } from 'lucide-react'

interface ListingMapProps {
  lat: number
  lng: number
  address: string
}

type MapStatus = 'idle' | 'loading' | 'ready' | 'error'

const LOAD_TIMEOUT_MS = 15_000
const SCRIPT_ID = 'google-maps-listing-script'

declare global {
  interface Window {
    __movalListingMapsReady?: () => void
  }
}

/**
 * Single-marker Google Maps for a listing detail page.
 * Takes lat/lng directly (no geocoding needed since Property has those fields).
 * Same sibling-overlay pattern as BusinessMap to avoid React/Google DOM conflicts.
 *
 * API key handling: read `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
 * directly in this 'use client' component (not via prop) so it doesn't
 * get serialized into the HTML payload.
 */
export function ListingMap({ lat, lng, address }: ListingMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapStatus, setMapStatus] = useState<MapStatus>('idle')
  const [statusMsg, setStatusMsg] = useState<string>('Loading map…')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

  useEffect(() => {
    if (!mounted) return
    if (!apiKey) {
      setStatusMsg('Map unavailable (no API key configured).')
      setMapStatus('error')
      return
    }
    if (!mapRef.current) {
      setStatusMsg('Map container not ready.')
      setMapStatus('error')
      return
    }

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    timeoutId = setTimeout(() => {
      if (cancelled) return
      setStatusMsg('Map took too long to load.')
      setMapStatus('error')
    }, LOAD_TIMEOUT_MS)

    function tryInit(el: HTMLDivElement, attemptsLeft = 200) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google
      if (cancelled) return
      if (g && g.maps && g.maps.Map && el) {
        if (timeoutId) clearTimeout(timeoutId)
        initMap(g, el)
        return
      }
      if (attemptsLeft <= 0) {
        if (timeoutId) clearTimeout(timeoutId)
        setStatusMsg('Map failed to load.')
        setMapStatus('error')
        return
      }
      setTimeout(() => tryInit(el, attemptsLeft - 1), 75)
    }

    window.__movalListingMapsReady = () => {
      if (mapRef.current) tryInit(mapRef.current)
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).google?.maps?.Map) {
        if (mapRef.current) tryInit(mapRef.current)
      } else {
        existing.addEventListener('load', () => {
          if (mapRef.current) tryInit(mapRef.current)
        }, { once: true })
        existing.addEventListener('error', () => {
          if (timeoutId) clearTimeout(timeoutId)
          setStatusMsg('Map failed to load.')
          setMapStatus('error')
        }, { once: true })
      }
    } else {
      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
        `&v=weekly&libraries=places&callback=__movalListingMapsReady`
      script.async = true
      script.defer = true
      script.onerror = () => {
        if (timeoutId) clearTimeout(timeoutId)
        setStatusMsg('Map failed to load.')
        setMapStatus('error')
      }
      document.head.appendChild(script)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function initMap(g: any, el: HTMLDivElement) {
      if (cancelled) return
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const GoogleMaps = g.maps as any
      const position = { lat, lng }
      const map = new GoogleMaps.Map(el, {
        zoom: 16,
        center: position,
        mapTypeControl: false,
        streetViewControl: false,
      })
      new GoogleMaps.Marker({
        map,
        position,
        title: address,
      })
      setMapStatus('ready')
    }

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      if (mapRef.current) {
        while (mapRef.current.firstChild) {
          mapRef.current.removeChild(mapRef.current.firstChild)
        }
      }
    }
  }, [mounted, apiKey, lat, lng, address])

  return (
    <div className="relative w-full h-full min-h-[288px]">
      <div
        ref={mapRef}
        className="absolute inset-0 w-full h-full"
        aria-label={`Map showing location of ${address}`}
      />

      {mapStatus !== 'ready' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 gap-3 z-10 pointer-events-none">
          {mapStatus === 'error' ? (
            <>
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <MapPin className="w-6 h-6" />
              </div>
              <p className="text-slate-700 font-medium">{address}</p>
              <p className="text-slate-400 text-xs">{statusMsg}</p>
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="pointer-events-auto inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
              >
                View on Google Maps <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </>
          ) : (
            <>
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse [animation-delay:150ms]" />
                <span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse [animation-delay:300ms]" />
              </div>
              <span className="text-slate-500 text-sm">
                {mapStatus === 'idle' ? 'Loading map…' : statusMsg}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
