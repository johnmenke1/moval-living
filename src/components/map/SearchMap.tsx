'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'

export interface SearchBusinessMapItem {
  id: string
  slug: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  latitude: number
  longitude: number
  category: { name: string; slug: string }
  tier: string
  isExpertPartner: boolean
  isBestOfWinner: boolean
  foundingPartnerSince: string | Date | null
  googleRating: number | null
  googleReviewCount: number | null
  hasCoupon?: boolean
}

interface SearchMapProps {
  businesses: SearchBusinessMapItem[]
  highlightedSlug?: string | null
  onMarkerClick?: (slug: string) => void
}

type MapStatus = 'idle' | 'loading' | 'ready' | 'error'

const LOAD_TIMEOUT_MS = 15_000
const SCRIPT_ID = 'google-maps-script'

declare global {
  interface Window {
    __movalMapsReady?: () => void
  }
}

const MARKER_COLOR = {
  expert: '#D97706',   // amber-600
  featured: '#F97316', // orange-500
  bestOf: '#007A7F',   // primary teal
  free: '#00405C',     // secondary navy
}

/**
 * SearchMap — multi-marker Google Maps for the /search business directory.
 *
 * Marker hierarchy:
 *   - Expert Partner / Founding Expert Partner (amber, largest, star icon)
 *   - Featured tier (orange)
 *   - Best Of winner (teal)
 *   - Free / standard (navy)
 *
 * API key handling: read NEXT_PUBLIC_GOOGLE_MAPS_API_KEY directly so it stays
 * in the client bundle and is not serialized into server-rendered HTML.
 *
 * CRITICAL: the <div> Google Maps mounts into (`mapRef`) MUST NOT contain
 * React-rendered children once mounted. Loading/error UI is rendered as a
 * SIBLING overlay.
 */
export function SearchMap({ businesses, highlightedSlug, onMarkerClick }: SearchMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapStatus, setMapStatus] = useState<MapStatus>('idle')
  const [statusMsg, setStatusMsg] = useState<string>('Loading map…')
  const [mounted, setMounted] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Record<string, any>>({})
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infoWindowRef = useRef<any>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Bootstrap the Google Maps script once, reused by all map components.
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
      const center = businessesCenter(businesses)
      const map = new GoogleMaps.Map(el, {
        center,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      })
      mapInstanceRef.current = map
      setMapStatus('ready')
    }

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      mapInstanceRef.current = null
      markersRef.current = {}
      infoWindowRef.current = null
      if (mapRef.current) {
        while (mapRef.current.firstChild) {
          mapRef.current.removeChild(mapRef.current.firstChild)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, apiKey])

  // Render / update markers whenever the business set changes.
  useEffect(() => {
    if (mapStatus !== 'ready') return
    const map = mapInstanceRef.current
    if (!map) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const GoogleMaps = (window as any).google?.maps as any
    if (!GoogleMaps) return

    // Clear previous markers.
    for (const m of Object.values(markersRef.current)) {
      m.setMap(null)
    }
    markersRef.current = {}
    if (infoWindowRef.current) {
      infoWindowRef.current.close()
      infoWindowRef.current = null
    }

    if (businesses.length === 0) {
      map.setCenter({ lat: 33.9425, lng: -117.2297 })
      map.setZoom(12)
      return
    }

    const bounds = new GoogleMaps.LatLngBounds()
    for (const b of businesses) {
      const marker = new GoogleMaps.Marker({
        map,
        position: { lat: b.latitude, lng: b.longitude },
        title: b.name,
        icon: buildMarkerIcon(GoogleMaps, b),
      })
      marker.addListener('click', () => {
        if (infoWindowRef.current) infoWindowRef.current.close()
        const html = infoHtml(b)
        const iw = new GoogleMaps.InfoWindow({ content: html, maxWidth: 300 })
        iw.open(map, marker)
        infoWindowRef.current = iw
        onMarkerClick?.(b.slug)
      })
      markersRef.current[b.slug] = marker
      bounds.extend({ lat: b.latitude, lng: b.longitude })
    }

    // Fit bounds with padding so the full set is visible; cap min/max zoom.
    map.fitBounds(bounds, 40)
    GoogleMaps.event.addListenerOnce(map, 'bounds_changed', () => {
      if (map.getZoom() > 16) map.setZoom(16)
      if (map.getZoom() < 12) map.setZoom(12)
    })
  }, [businesses, mapStatus, onMarkerClick])

  // Highlight sync: bounce the marker for the currently highlighted slug.
  useEffect(() => {
    if (mapStatus !== 'ready') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const GoogleMaps = (window as any).google?.maps as any
    if (!GoogleMaps) return
    for (const [slug, m] of Object.entries(markersRef.current)) {
      if (slug === highlightedSlug) {
        // Center map on highlighted marker without jumping too far.
        const pos = m.getPosition()
        if (pos) mapInstanceRef.current?.panTo(pos)
        m.setAnimation(GoogleMaps.Animation.BOUNCE)
        setTimeout(() => m.setAnimation(null), 700)
      }
    }
  }, [highlightedSlug, mapStatus])

  return (
    <div className="rounded-2xl border border-slate-200 shadow-sm overflow-hidden relative bg-white">
      {/* Map wrapper — owned by Google once mounted. Keep BARE. */}
      <div
        ref={mapRef}
        className="w-full h-[420px] bg-slate-100"
        aria-label="Map of Moreno Valley businesses"
        role="region"
      />

      {/* Loading / error overlay */}
      {mapStatus !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 pointer-events-none">
          <div className="text-center px-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary text-white mb-3">
              <MapPin className="w-6 h-6" />
            </div>
            <p className="text-sm text-text-secondary font-medium">{statusMsg}</p>
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

function markerPriority(b: SearchBusinessMapItem): { tier: 'expert' | 'featured' | 'bestOf' | 'free'; scale: number } {
  if (b.isExpertPartner || b.tier === 'EXPERT_PARTNER' || b.foundingPartnerSince) {
    return { tier: 'expert', scale: 14 }
  }
  if (b.tier === 'FEATURED') {
    return { tier: 'featured', scale: 12 }
  }
  if (b.isBestOfWinner) {
    return { tier: 'bestOf', scale: 10 }
  }
  return { tier: 'free', scale: 9 }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildMarkerIcon(GoogleMaps: any, b: SearchBusinessMapItem): any {
  const { tier, scale } = markerPriority(b)
  const color = MARKER_COLOR[tier]

  // For elevated tiers, use an SVG path pin shape instead of a circle.
  const isElevated = tier === 'expert' || tier === 'featured'
  if (isElevated) {
    return {
      path: 'M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z',
      fillColor: color,
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: scale / 12,
      anchor: { x: 12, y: 36 },
      labelOrigin: { x: 12, y: 12 },
    }
  }

  return {
    path: GoogleMaps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale,
  }
}

function infoHtml(b: SearchBusinessMapItem): string {
  const elevClass =
    b.isExpertPartner || b.tier === 'EXPERT_PARTNER'
      ? 'amber'
      : b.tier === 'FEATURED'
        ? 'orange'
        : b.isBestOfWinner
          ? 'teal'
          : 'navy'

  const badgeText = b.isExpertPartner || b.tier === 'EXPERT_PARTNER'
    ? b.foundingPartnerSince ? 'Founding Expert Partner' : 'Expert Partner'
    : b.tier === 'FEATURED'
      ? 'Featured'
      : b.isBestOfWinner
        ? 'Best of MoVal'
        : b.category.name

  const badgeColor =
    elevClass === 'amber' ? '#D97706'
    : elevClass === 'orange' ? '#F97316'
    : elevClass === 'teal' ? '#007A7F'
    : '#00405C'

  const stars = b.googleRating
    ? `<div style="display:flex;align-items:center;gap:4px;color:#CA8A04;font-size:12px;margin-top:4px;">
         <span>★ ${b.googleRating.toFixed(1)}</span>
         ${b.googleReviewCount ? `<span style="color:#64748b;">(${b.googleReviewCount.toLocaleString()} reviews)</span>` : ''}
       </div>`
    : ''

  const coupon = b.hasCoupon
    ? `<div style="display:inline-flex;align-items:center;gap:4px;color:#007A7F;font-size:11px;font-weight:600;margin-top:6px;">
         <span>🏷️ Deal available</span>
       </div>`
    : ''

  return `
    <div style="font-family:Inter,system-ui,sans-serif;padding:4px 2px;max-width:260px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:${badgeColor};border:1px solid ${badgeColor}22;background:${badgeColor}10;padding:2px 6px;border-radius:999px;">
          ${elevClass === 'amber' ? '⭐' : elevClass === 'orange' ? '★' : elevClass === 'teal' ? '👑' : '🏢'}
          ${escapeHtml(badgeText)}
        </span>
      </div>
      <div style="font-weight:700;font-size:14px;color:#0F172A;line-height:1.25;">${escapeHtml(b.name)}</div>
      <div style="font-size:11px;color:#64748B;margin-top:2px;line-height:1.35;">
        ${escapeHtml(b.address)}<br/>
        ${escapeHtml(b.city)}, ${escapeHtml(b.state)} ${escapeHtml(b.zip)}
      </div>
      ${stars}
      ${coupon}
      <a href="https://www.moval.living/business/${encodeURIComponent(b.slug)}"
         target="_blank"
         rel="noopener noreferrer"
         style="display:inline-flex;align-items:center;gap:3px;margin-top:8px;font-size:12px;font-weight:600;color:${badgeColor};text-decoration:none;">
         View listing →
      </a>
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

function businessesCenter(businesses: SearchBusinessMapItem[]): { lat: number; lng: number } {
  const withCoords = businesses.filter((b) => b.latitude != null && b.longitude != null) as SearchBusinessMapItem[]
  if (withCoords.length === 0) {
    return { lat: 33.9425, lng: -117.2297 }
  }
  const avgLat = withCoords.reduce((sum, b) => sum + b.latitude, 0) / withCoords.length
  const avgLng = withCoords.reduce((sum, b) => sum + b.longitude, 0) / withCoords.length
  return { lat: avgLat, lng: avgLng }
}
