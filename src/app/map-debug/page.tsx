'use client'

import { useState } from 'react'
import { MapPin, ExternalLink } from 'lucide-react'

const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

export default function MapDebug() {
  const [result, setResult] = useState<string>('')

  const testMap = () => {
    if (!apiKey) {
      setResult('❌ NO API KEY — NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set')
      return
    }
    setResult(`✅ API key found: ${apiKey.slice(0, 8)}...`)

    const scriptId = 'debug-maps-sdk'
    if (document.getElementById(scriptId)) {
      setResult(r => r + '\n⏳ Script already in DOM, removing and reloading...')
      document.getElementById(scriptId)?.remove()
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=mapDebugCallback`
    script.async = true
    script.defer = true
    ;(window as Record<string, unknown>).mapDebugCallback = () => {
      setResult(r => r + '\n✅ google.maps LOADED successfully')
      const map = new window.google.maps.Map(document.createElement('div'), {
        center: { lat: 33.9425, lng: -117.2297 },
        zoom: 13,
      })
      setResult(r => r + `\n✅ Map instance created: ${map.getZoom()}`)
    }
    script.onerror = (e) => {
      setResult(r => r + `\n❌ Script load error: ${JSON.stringify(e)}`)
    }
    document.head.appendChild(script)
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow p-6">
        <h1 className="text-2xl font-bold text-text mb-4">🗺️ Map Debug</h1>

        <div className="mb-4 p-4 bg-slate-100 rounded-xl">
          <p className="text-sm font-mono text-text-secondary">
            NEXT_PUBLIC_GOOGLE_MAPS_API_KEY:
          </p>
          <p className="font-mono text-sm mt-1">
            {apiKey ? (
              <span className="text-green-600">✅ {apiKey.slice(0, 12)}...{apiKey.slice(-4)}</span>
            ) : (
              <span className="text-red-600">❌ NOT SET</span>
            )}
          </p>
        </div>

        <button
          onClick={testMap}
          className="mb-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Run Map Test
        </button>

        {result && (
          <div className="p-4 bg-slate-900 rounded-xl">
            <p className="text-green-400 font-mono text-sm whitespace-pre-wrap">{result}</p>
          </div>
        )}

        <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm text-amber-800 font-medium mb-2">Checklist:</p>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>1. Is the API key shown above? If ❌ → add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in Vercel env vars</li>
            <li>2. Did the test say ✅ for both LOADED and Map instance? If ❌ → check browser console for errors</li>
            <li>3. If key is valid but map still fails → check Google Cloud Console: APIs &gt; Maps JavaScript API must be enabled, and HTTP restrictions must include moval.living</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
