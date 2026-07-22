'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, ExternalLink } from 'lucide-react'

interface BusinessMapProps {
  address: string
  city: string
  state: string
  zip: string
  name?: string
  /** Maps JS API key — pass from server component env so it reaches the client */
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
 * Hydration guard: renders a placeholder on the server and on first client
 * render (idle state). Only after `mounted` flips to true does the map
 * attempt to load — this eliminates hydration mismatches that would
 * otherwise kill the component before useEffect can attach the ref.
 */
export function BusinessMap({ address, city, state, zip, name, apiKey }: BusinessMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapStatus, setMapStatus] = useState<MapStatus>('idle')
  const [statusMsg, setStatusMsg] = useState<string>('Loading map…')
  const [mounted, setMounted] = useState(false)

  // Defer map loading until after hydration is complete.
  // This ensures the server and initial client renders are identical
  // (no DOM mismatch → no React error #418).
  useEffect(() => { setMounted(true) }, [])

  const fullAddress = `${address}, ${city}, ${state} ${zip}`
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`

  // ── Map loading (only runs after mounted=true) ────────────────────────────────
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

    const tryInit = (attemptsLeft = 200) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google
      if (cancelled) return
      if (g && g.maps && g.maps.Map && mapRef.current) {
        if (timeoutId) clearTimeout(timeoutId)
        initMap(g, mapRef.current)
        return
      }
      if (attemptsLeft <= 0) {
        if (timeoutId) clearTimeout(timeoutId)
        setStatusMsg('Map failed to load.')
        setMapStatus('error')
        return
      }
      setTimeout(() => tryInit(attemptsLeft - 1), 75)
    }

    window.__movalMapsReady = () => tryInit()

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).google?.maps?.Map) {
        tryInit()
      } else {
        existing.addEventListener('load', () => tryInit(), { once: true })
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

  // ── Render ────────────────────────────────────────────────────────────────────

  // "idle" = not yet mounted (SSR + first hydration paint).
  // Render the same placeholder on both so there is NO hydration mismatch.
  if (mapStatus === 'idle') {
    return (
      <div className="w-full h-full min-h-[288px] flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary/40 animate-pulse" />
            <span className="w-2 h-2 rounded-full bg-primary/40 animate-pulse [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-primary/40 animate-pulse [animation-delay:300ms]" />
          </div>
          <span className="text-slate-400 text-sm">Loading map…</span>
        </div>
      </div>
    )
  }

  if (mapStatus === 'error') {
    return (
      <div className="w-full h-full min-h-[288px] flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <MapPin className="w-6 h-6" />
          </div>
          <p className="text-slate-700 font-medium mb-1">{address}</p>
          <p className="text-slate-500 text-sm mb-4">{city}, {state} {zip}</p>
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
    )
  }

  // loading / ready
  return (
    <div
      ref={mapRef}
      className="w-full h-full min-h-[288px]"
      aria-label={`Map showing location of ${address}`}
    />
  )
}
