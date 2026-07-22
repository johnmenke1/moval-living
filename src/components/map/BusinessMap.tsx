'use client'

import { useEffect, useRef, useState } from 'react'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import { MapPin, ExternalLink } from 'lucide-react'

interface BusinessMapProps {
  address: string
  city: string
  state: string
  zip: string
  name?: string
}

type MapStatus = 'loading' | 'ready' | 'error'

/**
 * Renders a Google Maps embed for a single business address.
 *
 * - Loads the Maps JS API via `@googlemaps/js-api-loader`'s functional
 *   `setOptions()` + `importLibrary()` API.
 * - Geocodes the full address; on success, recenters the map and drops a marker.
 * - On any failure (no API key, geocode miss, network), renders a clean
 *   address card with a "Get directions" deep link so the section is never
 *   blank.
 */
export function BusinessMap({ address, city, state, zip, name }: BusinessMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading')
  const [statusMsg, setStatusMsg] = useState<string>('Loading map…')

  const fullAddress = `${address}, ${city}, ${state} ${zip}`
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  useEffect(() => {
    if (!mapRef.current) return

    // No key configured — fall back immediately.
    if (!apiKey) {
      setStatusMsg('Map unavailable.')
      setMapStatus('error')
      return
    }

    let cancelled = false

    // The functional loader is global; setOptions is safe to call once per
    // component instance — Google de-duplicates subsequent requests.
    setOptions({
      key: apiKey,
      v: 'weekly',
      libraries: ['places'],
    })

    importLibrary('maps')
      .then((mapsNS) => {
        if (cancelled || !mapRef.current) return
        // The new loader returns the maps namespace directly.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const GoogleMaps = mapsNS as unknown as typeof google.maps
        const map = new GoogleMaps.Map(mapRef.current, {
          zoom: 15,
          center: { lat: 33.9425, lng: -117.2297 }, // Moreno Valley default
          mapTypeControl: false,
          streetViewControl: false,
        })

        const geocoder = new GoogleMaps.Geocoder()
        geocoder.geocode({ address: fullAddress }, (results, status) => {
          if (cancelled) return
          if (status === 'OK' && results && results[0]) {
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
        })
      })
      .catch((err) => {
        console.error('[BusinessMap] Maps load failed:', err)
        if (cancelled) return
        setStatusMsg('Map failed to load.')
        setMapStatus('error')
      })

    return () => {
      cancelled = true
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
