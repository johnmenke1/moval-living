'use client'

import { useEffect, useRef, useState } from 'react'
import type { ParkSummary, UserLocation } from '@/lib/parks'
import { parksCenter, typeLabel } from '@/lib/parks'
import { MapPin } from 'lucide-react'

interface ParkMapProps {
  parks: ParkSummary[]
  /** The slug of the highlighted card → flip the matching marker to highlight. */
  highlightedSlug?: string | null
  /** Optional "near me" user location → renders a blue dot + re-centers. */
  userLocation?: UserLocation | null
  onMarkerClick?: (slug: string) => void
}

type MapStatus = 'idle' | 'loading' | 'ready' | 'error'

const LOAD_TIMEOUT_MS = 15_000
const SCRIPT_ID = 'google-maps-script'

// Color by type so the user can scan at-a-glance.
const MARKER_COLORS: Record<ParkSummary['type'], string> = {
  PARK: '#007A7F',       // primary teal
  GOLF: '#00405C',       // deep navy
  REC_CENTER: '#9B5C2E', // warm bronze
}

declare global {
  interface Window {
    __movalMapsReady?: () => void
  }
}

/**
 * ParkMap — live Google Maps for /parks.
 *
 * Renders one marker per park with lat/lng. Markers cluster at low zoom.
 * Hovering a marker (or a card outside the map) highlights the row;
 * clicking opens the InfoWindow and (via onMarkerClick) scrolls the card
 * into view.
 *
 * API key handling: read `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
 * directly. This component is 'use client', so Next.js inlines the value
 * into the JS bundle at build time. Reading via prop would serialize
 * it into the HTML payload as well, exposing it via raw curl even
 * before JS executes.
 *
 * CRITICAL: the <div> Google Maps mounts into (`mapRef`) MUST NOT
 * contain any React-rendered children once mounted. Google mutates that
 * DOM freely — adding tiles, controls, an internal shadow tree. If
 * React also tries to reconcile children inside that same node, you get
 * the `Failed to execute 'removeChild' on 'Node'` error, because
 * React's view of the DOM and Google's diverge.
 *
 * So: the wrapper is BARE from the moment `mounted === true`. Loading
 * / error UI is rendered as a SIBLING overlay (absolute-positioned)
 * that covers the wrapper while it's still needed, and is removed once
 * the map is ready. That way Google owns the wrapper's children 100%
 * of the time it's in use, and React never reconciles inside it.
 *
 * Markers are recreated when the parks array changes (filtered subset).
 * We hold them in a ref keyed by slug so we can highlight without
 * rebuilding the full set.
 */
export function ParkMap({ parks, highlightedSlug, userLocation, onMarkerClick }: ParkMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapStatus, setMapStatus] = useState<MapStatus>('idle')
  const [statusMsg, setStatusMsg] = useState<string>('Loading map…')
  const [mounted, setMounted] = useState(false)
  // Refs to live map state — recreated each time the parks array changes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clustererRef = useRef<any>(null)
  const infoWindowRef = useRef<unknown>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infoSlugRef = useRef<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Bootstrap the script exactly once. Subsequent renders reuse it.
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function initMap(g: any, el: HTMLDivElement) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const GoogleMaps = g.maps as any
      const c = parksCenter([])
      const map = new GoogleMaps.Map(el, {
        center: { lat: c.lat, lng: c.lng },
        zoom: c.zoom,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      })
      mapInstanceRef.current = map
      // Tell React the wrapper is now owned by Google. We flip
      // status to 'ready' AFTER the map has populated its DOM,
      // so React's next render won't try to reconcile inside
      // the wrapper.
      setMapStatus('ready')
      return map
    }

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      // Detach map references; let GC + DOM detach do the rest.
      mapInstanceRef.current = null
      markersRef.current = []
      clustererRef.current = null
      infoWindowRef.current = null
      if (mapRef.current) {
        while (mapRef.current.firstChild) {
          mapRef.current.removeChild(mapRef.current.firstChild)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, apiKey])

  // (Re-)render markers whenever the filtered parks set changes.
  useEffect(() => {
    if (mapStatus !== 'ready') return
    const map = mapInstanceRef.current
    if (!map) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const GoogleMaps = (window as any).google.maps as any
    if (!GoogleMaps) return

    // Clear previous markers (and their cluster).
    for (const m of markersRef.current) m.setMap(null)
    markersRef.current = []
    if (clustererRef.current) {
      clustererRef.current.clearMarkers()
      clustererRef.current = null
    }

    const withCoords = parks.filter(
      (p) => p.latitude != null && p.longitude != null,
    ) as Array<ParkSummary & { latitude: number; longitude: number }>

    if (withCoords.length === 0) {
      const c = parksCenter([])
      map.setCenter({ lat: c.lat, lng: c.lng })
      map.setZoom(c.zoom)
      return
    }

    const newMarkers = withCoords.map((p) => {
      const marker = new GoogleMaps.Marker({
        position: { lat: p.latitude, lng: p.longitude },
        title: p.name,
        icon: {
          path: GoogleMaps.SymbolPath.CIRCLE,
          fillColor: MARKER_COLORS[p.type],
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 9,
        },
      })
      marker.addListener('click', () => {
        if (infoWindowRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(infoWindowRef.current as any).close()
        }
        const html = infoHtml(p)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const iw = new GoogleMaps.InfoWindow({ content: html, maxWidth: 260 })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(iw as any).open(map, marker)
        infoWindowRef.current = iw
        infoSlugRef.current = p.slug
        onMarkerClick?.(p.slug)
      })
      return marker
    })
    markersRef.current = newMarkers

    // Clustering — only useful at low zoom where markers overlap.
    // DISABLED: the @googlemaps/markerclusterer JS lib is installed as
    // an npm dep but not <script>-loaded on the page, so window.MarkerClusterer
    // is undefined and the call would throw TypeError. The page works fine
    // without clustering at this size (40 markers). When we want clustering,
    // load the lib from a CDN <script> tag in src/app/parks/page.tsx, then
    // re-enable this block.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (window as any).MarkerClusterer !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clusterer = new (window as any).MarkerClusterer({
        map,
        markers: newMarkers,
        // Disable clustering at zoom 14+ so individual parks are visible.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderer: (window as any).MarkerClusterer.withDefaultRenderer({
          // Keep small icons since we have ~40 markers, not thousands.
          maxZoom: 14,
        }),
      })
      clustererRef.current = clusterer
    }

    // Fit bounds to current set. Use a small padding so the markers
    // don't sit on the edge of the visible area.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bounds = new GoogleMaps.LatLngBounds()
    for (const p of withCoords) bounds.extend({ lat: p.latitude, lng: p.longitude })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(map as any).fitBounds(bounds, 40)
    // If only one park, fitBounds zooms too far in. Cap it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listener = (window as any).google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
      if (map.getZoom() > 15) map.setZoom(15)
    })
    void listener
  }, [parks, mapStatus, onMarkerClick])

  // Highlight sync — when highlightedSlug changes from the card side,
  // bounce the matching marker (bounce animation draws the eye).
  useEffect(() => {
    if (mapStatus !== 'ready') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const GoogleMaps = (window as any).google?.maps as any
    if (!GoogleMaps) return
    for (const m of markersRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const title = (m as any).getTitle?.()
      if (title === highlightedSlug) {
        m.setAnimation(GoogleMaps.Animation.BOUNCE)
        setTimeout(() => m.setAnimation(null), 700)
      }
    }
  }, [highlightedSlug, mapStatus])

  // "Near me" — render a blue dot at the user's location and recenter.
  // Only runs when userLocation is non-null (i.e., user opted in).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any>(null)
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || mapStatus !== 'ready') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const GoogleMaps = (window as any).google?.maps as any
    if (!GoogleMaps) return

    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null)
      userMarkerRef.current = null
    }
    if (!userLocation) return

    userMarkerRef.current = new GoogleMaps.Marker({
      position: { lat: userLocation.latitude, lng: userLocation.longitude },
      map,
      title: 'Your location',
      icon: {
        path: GoogleMaps.SymbolPath.CIRCLE,
        fillColor: '#4285F4',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
        scale: 8,
      },
      zIndex: 9999,
    })
    // Recenter on the user, but keep the parks visible by zooming out a bit.
    map.setCenter({ lat: userLocation.latitude, lng: userLocation.longitude })
    map.setZoom(13)
    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.setMap(null)
        userMarkerRef.current = null
      }
    }
  }, [userLocation, mapStatus])

  return (
    <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative">
      {/* Map wrapper — owned by Google once mounted. Keep BARE. */}
      <div
        ref={mapRef}
        className="w-full h-[480px] bg-slate-100"
        aria-label="Map of Moreno Valley parks"
        role="region"
      />

      {/* Loading + error overlays — SIBLINGS of the map div, not children. */}
      {mapStatus !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 pointer-events-none">
          <div className="text-center px-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary text-white mb-3">
              <MapPin className="w-6 h-6" />
            </div>
            <p className="text-sm text-text-secondary">{statusMsg}</p>
            {mapStatus === 'error' && !apiKey && (
              <p className="mt-1 text-xs text-text-secondary">
                Add <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to enable the map.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** InfoWindow HTML — kept tiny and inline. No JSX here, just a string. */
function infoHtml(p: ParkSummary & { latitude: number; longitude: number }): string {
  const addr = p.address ? `<div style="font-size:11px;color:#475569;margin-top:2px;">${escapeHtml(p.address)}</div>` : ''
  const rating = p.googleRating
    ? `<div style="font-size:11px;color:#475569;margin-top:4px;">★ ${p.googleRating.toFixed(1)}${p.googleReviewCount ? ` · ${p.googleReviewCount} reviews` : ''}</div>`
    : ''
  return `
    <div style="font-family:Inter,system-ui,sans-serif;padding:4px 2px;max-width:240px;">
      <div style="font-weight:600;font-size:13px;color:#0f172a;">${escapeHtml(p.name)}</div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#007A7F;margin-top:2px;">${typeLabel(p.type)}</div>
      ${addr}
      ${rating}
    </div>
  `.trim()
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
