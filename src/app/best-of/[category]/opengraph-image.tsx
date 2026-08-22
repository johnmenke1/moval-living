import { ImageResponse } from 'next/og'

export const alt = 'Best Of MoVal'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Font loading: Vercel does NOT include /public in the function's filesystem
// at /var/task/public/ — public files are served via the edge CDN only.
// The fs.readFile(process.cwd() + 'public/...') pattern works locally but
// ENOENTs on Vercel. The working pattern is fetch() against the deployed
// origin (Vercel edge serves /public at the same hostname, cached aggressively).
let _fontsCache: { fraunces: ArrayBuffer; inter: ArrayBuffer } | null = null
async function loadFonts() {
  if (_fontsCache) return _fontsCache
  const [fraunces, inter] = await Promise.all([
    fetch('https://www.moval.living/fonts/Fraunces-Bold.ttf').then(r => {
      if (!r.ok) throw new Error(`Fraunces fetch failed: ${r.status}`)
      return r.arrayBuffer()
    }),
    fetch('https://www.moval.living/fonts/Inter-SemiBold.ttf').then(r => {
      if (!r.ok) throw new Error(`Inter fetch failed: ${r.status}`)
      return r.arrayBuffer()
    }),
  ])
  _fontsCache = { fraunces, inter }
  return _fontsCache
}

export default async function OGImage() {
  const fonts = await loadFonts()

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
        { name: 'Fraunces', data: fonts.fraunces, weight: 700, style: 'normal' },
        { name: 'Inter', data: fonts.inter, weight: 600, style: 'normal' },
      ],
    },
  )
}
