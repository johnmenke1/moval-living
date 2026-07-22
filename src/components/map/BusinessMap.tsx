'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, ExternalLink } from 'lucide-react'

interface BusinessMapProps {
  address: string
  city: string
  state: string
  zip: string
  name?: string
  /** Maps JS API key. Must be passed in by the parent server component. */
  apiKey?: string
}

type MapStatus = 'idle' | 'loading' | 'ready' | 'error'

const LOAD_TIMEOUT_MS = 15_000
const SCRIPT_ID = 'google-maps-script'

declare global {
  interface Window {
    __movalMapsReady?: () => void
  }
}

/**
 * Renders a Google Maps embed for a single business address.
 *
 * The `ref` lives on a single wrapper <div> that is rendered in ALL
 * states (idle, loading, ready, error). This means `mapRef.current` is
 * never null once the component has mounted on the client, and the
 * loader effect can always find a DOM node to mount the map into.
 *
 * The previous design had three `return` branches, each with its own
 * outer div, and only the third branch carried the ref — so the loader
 * effect ran before React rendered the ref-bearing div, bailed with
 * "Map container not ready," and the user was stuck on the error
 * card forever.
 */
export function BusinessMap({
  address,
  city,
  state,
  zip,
  name,
  apiKey,
}: BusinessMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapStatus, setMapStatus] = useState<MapStatus>('idle')
  const [statusMsg, setStatusMsg] = useState<string>('Loading map…')
  const [mounted, setMounted] = useState(false)

  // Defer map loading until after hydration so SSR and first client
  // render are byte-identical (no React #418 text-mismatch).
  useEffect(() => {
    setMounted(true)
  }, [])

  const fullAddress = `${address}, ${city}, ${state} ${zip}`
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`

  useEffect(() => {
    if (!mounted) return
    if (!apiKey) {
      setStatusMsg('Map unavailable (no API key configured).')
      setMapStatus('error')
      return
    }
    if (!mapRef.current) {
      // With the stable-wrapper render below, this branch should be
      // unreachable on the client. If it ever fires, it's a real bug.
      console.warn('[BusinessMap] mapRef.current is null after mount')
      setStatusMsg('Map container not ready.')
      setMapStatus('error')
      return
    }

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    // Hard timeout so the user never spins forever.
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

    // Global callback the Maps bootstrap script will invoke.
    window.__movalMapsReady = () => {
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
        existing.addEventListener(
          'error',
          () => {
            if (timeoutId) clearTimeout(timeoutId)
            setStatusMsg('Map failed to load.')
            setMapStatus('error')
          },
          { once: true },
        )
      }
    } else {
      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
        `&v=weekly&libraries=places&callback=__movalMapsReady`
      script.async = true
      script.defer = true
      script.onerror = () => {
        if (timeoutId) clearTimeout(timeoutId)
        setStatusMsg('Map failed to load.')
        setMapStatus('error')
      }
      document.head.appendChild(script)
    }

    function initMap(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      g: any,
      el: HTMLDivElement,
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const GoogleMaps = g.maps as any
      const map = new GoogleMaps.Map(el, {
        zoom: 15,
        center: { lat: 33.9425, lng: -117.2297 },
        mapTypeControl: false,
        streetViewControl: false,
      })

      const geocoder = new GoogleMaps.Geocoder()
      geocoder.geocode(
        { address: fullAddress },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (results: any, geocodeStatus: string) => {
          if (cancelled) return
          if (geocodeStatus === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location
            map.setCenter(loc)
            new GoogleMaps.Marker({
              map,
              position: loc,
              title: name || fullAddress,
            })
            setMapStatus('ready')
          } else {
            setStatusMsg("Couldn't locate this address on the map.")
            setMapStatus('error')
          }
        },
      )
    }

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [mounted, apiKey, fullAddress, name])

  // ONE stable wrapper. The ref is attached in every render.
  // Children swap based on mapStatus, but the wrapper itself never unmounts
  // across state transitions — so mapRef.current is reliable from the
  // moment the component mounts on the client.
  return (
    <div
      ref={mapRef}
      className="w-full h-full min-h-[288px]"
      aria-label={`Map showing location of ${address}`}
    >
      {mapStatus === 'idle' && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 gap-3">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary/40 animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-primary/40 animate-pulse [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-primary/40 animate-pulse [animation-delay:300ms]" />
          </div>
          <span className="text-slate-400 text-sm">Loading map…</span>
        </div>
      )}

      {mapStatus === 'loading' && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 gap-3">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-primary/60 animate-pulse [animation-delay:300ms]" />
          </div>
          <span className="text-slate-500 text-sm">{statusMsg}</span>
        </div>
      )}

      {mapStatus === 'error' && (
        <div className="w-full h-full flex items-center justify-center bg-slate-50 p-6">
          <div className="text-center max-w-sm">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-6 h-6" />
            </div>
            <p className="text-slate-700 font-medium mb-1">{address}</p>
            <p className="text-slate-500 text-sm mb-4">
              {city}, {state} {zip}
            </p>
            <p className="text-slate-400 text-xs mb-4">{statusMsg}</p>
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
            >
              Get directions <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* When mapStatus === 'ready' the wrapper itself is the map
          container — Google Maps replaces its children with the canvas. */}
    </div>
  )
}
