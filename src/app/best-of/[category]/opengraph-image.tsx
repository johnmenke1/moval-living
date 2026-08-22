import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'Best Of MoVal'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Fonts at project root (./fonts/), not in public/. Next bundles anything
// reachable via the static module graph. /public/ is served via the edge
// CDN only and is NOT in /var/task/public/ at runtime (ENOENT confirmed
// in 5deef95 logs).
let _frauncesCache: Buffer | null = null
async function loadFraunces() {
  if (_frauncesCache) return _frauncesCache
  _frauncesCache = await readFile(join(process.cwd(), 'fonts/Fraunces-Bold.ttf'))
  return _frauncesCache
}

export default async function OGImage() {
  const fraunces = await loadFraunces()

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
