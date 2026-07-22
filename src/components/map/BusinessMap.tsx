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
 * Critical architectural note: the <div> that Google Maps mounts into
 * (`mapRef`) MUST NOT contain any React-rendered children after the map
 * starts loading. Google mutates that DOM freely — adding tiles,
 * controls, an internal shadow tree. If React also tries to reconcile
 * children inside that same node, you get the
 * `Failed to execute 'removeChild' on 'Node': The node to be removed
 * is not a child of this node.` error, because React's view of the
 * DOM and Google's diverge.
 *
 * So: the wrapper is BARE from the moment `mounted === true`. Loading
 * / error UI is rendered as a SIBLING overlay (absolute-positioned)
 * that covers the wrapper while it's still needed, and is removed once
 * the map is ready. That way Google owns the wrapper's children 100%
 * of the time it's in use, and React never reconciles inside it.
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
      console.warn('[BusinessMap] mapRef.current is null after mount')
      setStatusMsg('Map container not ready.')
      setMapStatus('error')
      return
    }

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let mapInstance: unknown = null

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
        mapInstance = initMap(g, el)
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

    window.__movalMapsReady = () => {
      if (mapRef.current) tryInit(mapRef.current)
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).google?.maps?.Map) {
        if (mapRef.current) tryInit(mapRef.current)
      } else {
        existing.addEventListener(
          'load',
          () => {
            if (mapRef.current) tryInit(mapRef.current)
          },
          { once: true },
        )
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
            // Tell React the wrapper is now owned by Google. We flip
            // status to 'ready' AFTER the map has populated its DOM,
            // so React's next render won't try to reconcile inside
            // the wrapper.
            setMapStatus('ready')
          } else {
            setStatusMsg("Couldn't locate this address on the map.")
            setMapStatus('error')
          }
        },
      )
      return map
    }

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      // Drop our reference to the map so GC can clean it up. We do NOT
      // call map.setMap(null) or similar — Google's internal cleanup
      // happens automatically when the DOM node is detached.
      mapInstance = null
      // Wipe the wrapper's children so any leftover Google DOM doesn't
      // sit there if React keeps this component instance alive.
      if (mapRef.current) {
        while (mapRef.current.firstChild) {
          mapRef.current.removeChild(mapRef.current.firstChild)
        }
      }
    }
  }, [mounted, apiKey, fullAddress, name])

  // Overlay that covers the map wrapper during loading/error.
  // It's a SIBLING, not a child, so React never reconciles inside
  // the wrapper while Google is mutating it.
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
              <p className="text-slate-500 text-sm">
                {city}, {state} {zip}
              </p>
              <p className="text-slate-400 text-xs">{statusMsg}</p>
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="pointer-events-auto inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
              >
                Get directions <ExternalLink className="w-3.5 h-3.5" />
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
