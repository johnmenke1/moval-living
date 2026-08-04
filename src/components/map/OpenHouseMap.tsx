'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, ExternalLink } from 'lucide-react'
import type { OpenHouseListing } from '@/app/api/trestle/open-houses/route'

interface OpenHouseMapProps {
  listings: OpenHouseListing[]
  highlightedKey?: string | null
  apiKey?: string
}

type MapStatus = 'idle' | 'loading' | 'ready' | 'error'

const LOAD_TIMEOUT_MS = 15_000
const SCRIPT_ID = 'google-maps-oh-script'
const MORENO_VALLEY_CENTER = { lat: 33.9425, lng: -117.2297 }

declare global {
  interface Window {
    __movalOHMapsReady?: () => void
  }
}

/**
 * Multi-marker Google Maps embed for open house listings.
 * Clicking a marker highlights the corresponding card.
 * Uses the same sibling-overlay pattern as BusinessMap to avoid
 * React/Google DOM reconciliation conflicts.
 */
export function OpenHouseMap({ listings, highlightedKey, apiKey }: OpenHouseMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapStatus, setMapStatus] = useState<MapStatus>('idle')
  const [statusMsg, setStatusMsg] = useState<string>('Loading map…')
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    if (!apiKey) {
      setStatusMsg('Map unavailable (no API key configured).')
      setMapStatus('error')
      return
    }
    if (!mapRef.current) return

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

    window.__movalOHMapsReady = () => {
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
        `&v=weekly&libraries=places&callback=__movalOHMapsReady`
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
        zoom: 12,
        center: MORENO_VALLEY_CENTER,
        mapTypeControl: false,
        streetViewControl: false,
      })

      // Bounds — auto-zoom to fit all markers
      const bounds = new GoogleMaps.LatLngBounds()

      const infoWindow = new GoogleMaps.InfoWindow()

      // Geocode each listing and place a marker
      const geocoder = new GoogleMaps.Geocoder()
      let resolvedCount = 0

      listings.forEach((listing) => {
        geocoder.geocode(
          { address: listing.address },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (results: any, geocodeStatus: string) => {
            if (cancelled) return
            resolvedCount++

            if (geocodeStatus === 'OK' && results && results[0]) {
              const loc = results[0].geometry.location
              const isHighlighted = listing.listingKey === highlightedKey

              const marker = new GoogleMaps.Marker({
                position: loc,
                map,
                title: listing.address,
                animation: isHighlighted
                  ? GoogleMaps.Animation.BOUNCE
                  : undefined,
              })

              // Color: highlighted = primary teal, else slate
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              marker.addListener('click', () => {
                const oh = listing.openHouses[0]
                const ohDate = oh
                  ? new Date(oh.openHouseDate + 'T00:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })
                  : ''
                infoWindow.setContent(`
                  <div style="font-family:sans-serif; padding:4px; min-width:180px;">
                    <strong style="font-size:14px;">${listing.address}</strong><br/>
                    <span style="color:#666; font-size:12px;">${listing.listPrice.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</span><br/>
                    ${ohDate ? `<span style="color:#007a7f; font-size:12px; font-weight:600;">Open House: ${ohDate}</span>` : ''}
                  </div>
                `)
                infoWindow.open(map, marker)

                // Scroll the card into view — dispatch a custom event
                window.dispatchEvent(
                  new CustomEvent('oh:highlight', { detail: { key: listing.listingKey } })
                )
              })

              bounds.extend(loc)
            }

            // Once all geocoding requests have resolved (or after enough attempts), fit bounds
            if (resolvedCount >= listings.length) {
              if (!cancelled && listings.length > 0) {
                try {
                  map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 })
                } catch {
                  // Single marker or bounds failure — use default zoom
                  map.setCenter(MORENO_VALLEY_CENTER)
                  map.setZoom(12)
                }
              }
            }
          }
        )
      })

      // Fallback: if geocoding stalls, fit bounds after timeout
      setTimeout(() => {
        if (!cancelled && listings.length > 0) {
          try { map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 }) } catch { /* ok */ }
        }
      }, 5000)

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
  }, [mounted, apiKey, listings, highlightedKey])

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-xl overflow-hidden">
      <div
        ref={mapRef}
        className="absolute inset-0 w-full h-full"
        aria-label="Map showing upcoming open house locations in Moreno Valley"
      />

      {mapStatus !== 'ready' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 gap-3 z-10">
          {mapStatus === 'error' ? (
            <>
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <MapPin className="w-6 h-6" />
              </div>
              <p className="text-slate-600 text-sm font-medium">Map unavailable</p>
              <p className="text-slate-400 text-xs">{statusMsg}</p>
              <a
                href="https://www.google.com/maps/search/?api=1&query=Moreno+Valley+CA"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
              >
                View Moreno Valley on Google Maps <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </>
          ) : (
            <>
              <div className="flex gap-1.5">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="w-2 h-2 rounded-full bg-primary/60 animate-pulse"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
              <span className="text-slate-500 text-sm">
                {mapStatus === 'idle' ? 'Loading map…' : statusMsg}
              </span>
            </>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-sm z-10">
        <p className="text-xs font-semibold text-text">
          {listings.length} Open House{listings.length !== 1 ? 's' : ''} · Moreno Valley
        </p>
      </div>
    </div>
  )
}
