'use client'

import { useEffect, useRef, useState } from 'react'
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
 * Uses a plain <script> tag for maximum reliability — no extra packages needed.
 * Geocodes the full address; on success, drops a pin and centers the map.
 * On any failure renders an address card with a "Get directions" deep link.
 */
export function BusinessMap({ address, city, state, zip, name }: BusinessMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapStatus, setMapStatus] = useState<MapStatus>('loading')
  const [statusMsg, setStatusMsg] = useState('Loading map…')

  const fullAddress = `${address}, ${city}, ${state} ${zip}`
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`

  useEffect(() => {
    if (!mapRef.current || !apiKey) return

    // Helper to initialise the map once google.maps is ready
    const initMap = () => {
      if (!mapRef.current) return
      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 15,
        center: { lat: 33.9425, lng: -117.2297 }, // Moreno Valley coords; geocode will override
        mapTypeControl: false,
        streetViewControl: false,
      })

      const geocoder = new window.google.maps.Geocoder()
      geocoder.geocode({ address: fullAddress }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          map.setCenter(results[0].geometry.location)
          new window.google.maps.Marker({
            map,
            position: results[0].geometry.location,
            title: name || fullAddress,
          })
          setMapStatus('ready')
        } else {
          setStatusMsg("Couldn't locate this address on the map.")
          setMapStatus('error')
        }
      })
    }

    // Already loaded by a previous component instance
    if (window.google?.maps) {
      initMap()
      return
    }

    const scriptId = 'google-maps-sdk-script'
    const existing = document.getElementById(scriptId)
    if (existing) {
      // Script tag exists but may not be done yet; wait for it
      existing.addEventListener('load', initMap)
      return
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap`
    script.async = true
    script.defer = true
    // Store initMap on window so the callback can find it
    ;(window as unknown as Record<string, unknown>).initMap = initMap
    script.onerror = () => {
      setStatusMsg('Map failed to load.')
      setMapStatus('error')
    }
    document.head.appendChild(script)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, fullAddress])

  if (!apiKey) {
    return (
      <div className="w-full h-full min-h-[288px] flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <MapPin className="w-6 h-6" />
          </div>
          <p className="text-text font-medium mb-1">{address}</p>
          <p className="text-text-secondary text-sm mb-4">{city}, {state} {zip}</p>
          <p className="text-text-secondary text-xs mb-4">Map unavailable — add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</p>
          <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            Get directions <ExternalLink className="w-3.5 h-3.5" />
          </a>
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
          <p className="text-text font-medium mb-1">{address}</p>
          <p className="text-text-secondary text-sm mb-4">{city}, {state} {zip}</p>
          <p className="text-text-secondary text-xs mb-4">{statusMsg}</p>
          <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            Get directions <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    )
  }

  // loading
  return (
    <div className="w-full h-full min-h-[288px] flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
        </div>
        <span className="text-text-secondary text-sm">{statusMsg}</span>
      </div>
    </div>
  )
}
