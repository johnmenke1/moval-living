import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'Best Of MoVal'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Next 16 OG-image canonical pattern: function takes no args, fonts via
// readFile(process.cwd()). Try this baseline first to confirm the route
// works at all in our Vercel deploy.
export default async function OGImage() {
  const fraunces = await readFile(
    join(process.cwd(), 'public/fonts/Fraunces-Bold.ttf')
  )
  const inter = await readFile(
    join(process.cwd(), 'public/fonts/Inter-SemiBold.ttf')
  )

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage:
            'linear-gradient(135deg, #00405c 0%, #007a7f 100%)',
          color: '#f0efeb',
          fontFamily: 'Inter',
          fontSize: 88,
          fontWeight: 600,
        }}
      >
        Best Of MoVal
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Fraunces', data: fraunces, weight: 700, style: 'normal' },
        { name: 'Inter', data: inter, weight: 600, style: 'normal' },
      ],
    },
  )
}
