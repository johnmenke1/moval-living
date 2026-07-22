'use client'

import { useEffect, useRef } from 'react'

interface BusinessMapProps {
  address: string
  city: string
  state: string
  zip: string
}

export function BusinessMap({ address, city, state, zip }: BusinessMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!window.google || !mapRef.current) return

    const fullAddress = `${address}, ${city}, ${state} ${zip}`
    const map = new google.maps.Map(mapRef.current, {
      zoom: 15,
      disableDefaultUI: false,
    })

    const geocoder = new google.maps.Geocoder()
    geocoder.geocode({ address: fullAddress }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        map.setCenter(results[0].geometry.location)
        new google.maps.Marker({
          map,
          position: results[0].geometry.location,
          title: 'Business Location',
        })
      }
    })
  }, [address, city, state, zip])

  return (
    <div
      ref={mapRef}
      className="w-full h-full"
      aria-label={`Map showing location of ${address}`}
    />
  )
}
