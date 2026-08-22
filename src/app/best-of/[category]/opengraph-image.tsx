import { ImageResponse } from 'next/og'

export const alt = 'Best Of MoVal'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Minimal repro: no fonts, no DB, just a colored rectangle. If THIS renders
// we know the route + ImageResponse work; the previous 500s were from fonts.
// If THIS also 500s, the issue is something deeper (Next 16 OG route config,
// runtime, build artifact).
export default async function OGImage() {
  console.log('[opengraph-image] handler invoked')

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
          fontSize: 64,
        }}
      >
        Best Of MoVal
      </div>
    ),
    { ...size },
  )
}
