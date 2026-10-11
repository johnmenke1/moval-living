'use client'

import { useEffect, useRef, useState } from 'react'
import type { PublicHalloweenEntry } from '@/lib/halloween-queries'

interface HauntedMapProps {
  entries: PublicHalloweenEntry[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const SCRIPT_ID = 'google-maps-haunted-script'
const MORENO_VALLEY_CENTER = { lat: 33.9425, lng: -117.2297 }
const LOAD_TIMEOUT_MS = 15_000

declare global {
  interface Window {
    __movalHauntedMapsReady?: () => void
  }
}

// Classic "night" map style.
const NIGHT_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#140a22' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#140a22' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#a48ac7' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#ff9a4a' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1b2a1c' }, { visibility: 'on' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a1744' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1a0d2c' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4a2478' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#ffb877' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#08040f' }] },
]

function pumpkinIcon(selected: boolean): string {
  const size = selected ? 52 : 40
  const glow = selected
    ? '<circle cx="24" cy="26" r="21" fill="#ff7a1a" opacity="0.28"/>'
    : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">${glow}
<path d="M24 11c1-4 3-6 6-6" stroke="#5bd16a" stroke-width="3" fill="none" stroke-linecap="round"/>
<ellipse cx="15" cy="28" rx="9" ry="13" fill="#e8620c"/><ellipse cx="33" cy="28" rx="9" ry="13" fill="#e8620c"/>
<ellipse cx="24" cy="28" rx="9" ry="14" fill="#ff8a1f"/>
<path d="M17 25l4 4-8 0z M31 25l-4 4 8 0z" fill="#2a0f00"/>
<path d="M16 34q8 7 16 0l-3-2-2 2-3-2-3 2-2-2z" fill="#2a0f00"/></svg>`
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg)
}

export function HauntedMap({ entries, selectedId, onSelect }: HauntedMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const mapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapObj = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markers = useRef<Map<string, any>>(new Map())
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infoWindow = useRef<any>(null)
  const fitted = useRef(false)
  const onSelectRef = useRef(onSelect)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [msg, setMsg] = useState('Summoning the map…')
  const [mapVersion, setMapVersion] = useState(0)

  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  // Load the Maps script + create the map once.
  useEffect(() => {
    if (!apiKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMsg('Map unavailable (no API key configured).')
      setStatus('error')
      return
    }
    let cancelled = false
    const timeout = setTimeout(() => {
      if (cancelled) return
      setMsg('The map took too long to load.')
      setStatus('error')
    }, LOAD_TIMEOUT_MS)

    function init() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = (window as any).google
      if (cancelled || !g?.maps?.Map || !mapRef.current) return
      clearTimeout(timeout)
      mapObj.current = new g.maps.Map(mapRef.current, {
        center: MORENO_VALLEY_CENTER,
        zoom: 12,
        styles: NIGHT_STYLE,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
      })
      infoWindow.current = new g.maps.InfoWindow()
      setStatus('ready')
      setMapVersion((v) => v + 1)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).google?.maps?.Map) {
      init()
    } else {
      window.__movalHauntedMapsReady = init
      if (!document.getElementById(SCRIPT_ID)) {
        const script = document.createElement('script')
        script.id = SCRIPT_ID
        script.src =
          `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}` +
          `&v=weekly&callback=__movalHauntedMapsReady`
        script.async = true
        script.onerror = () => {
          clearTimeout(timeout)
          setMsg('The map failed to load.')
          setStatus('error')
        }
        document.head.appendChild(script)
      }
    }
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [apiKey])

  // Sync markers with entries.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google
    const map = mapObj.current
    if (status !== 'ready' || !g?.maps || !map) return

    const seen = new Set<string>()
    const bounds = new g.maps.LatLngBounds()
    let hasAny = false
    for (const e of entries) {
      if (e.latitude == null || e.longitude == null) continue
      seen.add(e.id)
      hasAny = true
      const pos = { lat: e.latitude, lng: e.longitude }
      bounds.extend(pos)
      const existing = markers.current.get(e.id)
      if (existing) {
        existing.setPosition(pos)
        existing.setTitle(e.displayName)
      } else {
        const m = new g.maps.Marker({
          map,
          position: pos,
          title: e.displayName,
          icon: { url: pumpkinIcon(false), scaledSize: new g.maps.Size(40, 40), anchor: new g.maps.Point(20, 36) },
        })
        m.addListener('click', () => onSelectRef.current(e.id))
        markers.current.set(e.id, m)
      }
    }
    for (const [id, m] of markers.current) {
      if (!seen.has(id)) {
        m.setMap(null)
        markers.current.delete(id)
      }
    }
    if (hasAny && !fitted.current) {
      fitted.current = true
      map.fitBounds(bounds, 60)
      g.maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom() > 15) map.setZoom(15)
      })
    }
  }, [entries, status, mapVersion])

  // Highlight the selected home.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = (window as any).google
    const map = mapObj.current
    if (status !== 'ready' || !g?.maps || !map) return
    for (const [id, m] of markers.current) {
      const sel = id === selectedId
      const size = sel ? 52 : 40
      m.setIcon({ url: pumpkinIcon(sel), scaledSize: new g.maps.Size(size, size), anchor: new g.maps.Point(size / 2, size * 0.9) })
      m.setZIndex(sel ? 999 : 1)
    }
    const entry = entries.find((e) => e.id === selectedId)
    if (entry && entry.latitude != null && entry.longitude != null) {
      map.panTo({ lat: entry.latitude, lng: entry.longitude })
      if ((map.getZoom() ?? 0) < 14) map.setZoom(14)
      const wrap = document.createElement('div')
      wrap.style.cssText = 'font-family:system-ui,sans-serif;color:#1b0b2e;max-width:220px'
      const title = document.createElement('div')
      title.style.cssText = 'font-weight:700;font-size:14px'
      title.textContent = entry.displayName
      const sub = document.createElement('div')
      sub.style.cssText = 'font-size:12px;margin-top:2px;color:#5a3c80'
      sub.textContent = `${entry.locationLabel ?? ''} · ${entry.votes} vote${entry.votes === 1 ? '' : 's'}`
      wrap.append(title, sub)
      infoWindow.current?.setContent(wrap)
      const marker = markers.current.get(entry.id)
      if (marker) infoWindow.current?.open({ map, anchor: marker })
    } else {
      infoWindow.current?.close()
    }
  }, [selectedId, entries, status])

  return (
    <div className="relative w-full h-full min-h-[320px] rounded-2xl overflow-hidden border border-[#3a1d57] bg-[#140a22]">
      <div ref={mapRef} className="absolute inset-0" />
      {status !== 'ready' && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-purple-200/80 pointer-events-none">
          {msg}
        </div>
      )}
    </div>
  )
}
