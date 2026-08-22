import { ImageResponse } from 'next/og'

export const alt = 'Best Of MoVal'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

let _frauncesCache: ArrayBuffer | null = null
async function loadFraunces() {
  if (_frauncesCache) return _frauncesCache
  const r = await fetch('https://www.moval.living/fonts/Fraunces-Bold.ttf')
  if (!r.ok) throw new Error(`Fraunces fetch failed: ${r.status}`)
  _frauncesCache = await r.arrayBuffer()
  return _frauncesCache
}

export default async function OGImage() {
  console.log('[opengraph-image] loading Fraunces')
  const fraunces = await loadFraunces()
  console.log(`[opengraph-image] Fraunces loaded: ${fraunces.byteLength} bytes`)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#007a7f',
          color: '#f0efeb',
          fontFamily: 'Fraunces',
          fontSize: 64,
        }}
      >
        Best Of MoVal
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Fraunces', data: fraunces, weight: 700, style: 'normal' }],
    },
  )
}
