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

type MapStatus = 'loading' | 'ready' | 'error'

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
 * Why this is so plain: every "smart" loader wrapper we tried
 * (`@googlemaps/js-api-loader`'s functional `setOptions` / `importLibrary`,
 * and the `Loader` class which is no longer exported at runtime in v2.x)
 * silently failed to inject the bootstrap script in this app. The
 * no-dependency pattern below — a single `<script>` tag with a `callback`
 * param and a polling `useEffect` — is what we proved works in
 * `/map-test.html`. It is boring on purpose.
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
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading')
  const [statusMsg, setStatusMsg] = useState<string>('Loading map…')

  const fullAddress = `${address}, ${city}, ${state} ${zip}`

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log('[BusinessMap] mount, apiKey len=', (apiKey || '').length, 'addr=', fullAddress)
    if (!mapRef.current) {
      // eslint-disable-next-line no-console
      console.log('[BusinessMap] no mapRef, bailing')
      return
    }

    if (!apiKey) {
      setStatusMsg('Map unavailable (no API key configured).')
      setMapStatus('error')
      return
    }

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    // 1) Hard timeout.
    timeoutId = setTimeout(() => {
      if (cancelled) return
      setStatusMsg('Map took too long to load.')
      setMapStatus('error')
    }, LOAD_TIMEOUT_MS)

    // 2) Once `window.google.maps.Map` exists, render.
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

    // 3) Wire the global callback BEFORE the script is appended. The Maps
    //    bootstrap script calls this once the API is fully parsed.
    window.__movalMapsReady = () => tryInit()

    // 4) Inject the script (or hook the existing one).
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
            setStatusMsg('We couldn’t pinpoint the address on the map.')
            setMapStatus('error')
          }
        },
      )
    }

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [apiKey, fullAddress, name])

  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`

  if (mapStatus === 'error') {
    return (
      <div className="w-full h-full min-h-[288px] flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <MapPin className="w-6 h-6" />
          </div>
          <p className="text-text font-medium mb-1">{address}</p>
          <p className="text-text-secondary text-sm mb-4">
            {city}, {state} {zip}
          </p>
          <p className="text-text-secondary text-xs mb-4">{statusMsg}</p>
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Get directions <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    )
  }

  if (mapStatus === 'loading') {
    return (
      <div className="w-full h-full min-h-[288px] flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-text-secondary text-sm">
          <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse" />
          <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse [animation-delay:150ms]" />
          <div className="w-2 h-2 rounded-full bg-primary/60 animate-pulse [animation-delay:300ms]" />
          <span className="ml-2">{statusMsg}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={mapRef}
      className="w-full h-full min-h-[288px]"
      aria-label={`Map showing location of ${address}`}
    />
  )
}
