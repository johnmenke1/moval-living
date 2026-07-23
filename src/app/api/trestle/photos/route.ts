import { NextResponse } from 'next/server'

/**
 * Trestle listing photo proxy.
 *
 * Trestle/CRMLS photos are served from a CDN URL embedded in the Property resource
 * (MediaURL or PhotoURL fields). This route proxies the photo so the client never
 * needs to know the actual CDN URL or auth details.
 *
 * Strategy: redirect to the CDN URL (302) so photos load fast with zero server cost.
 * If no photo URL is available, return a transparent 1x1 SVG.
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get('key')
  const url = searchParams.get('url')

  if (!key && !url) {
    return new NextResponse('', { status: 204 })
  }

  // If we have a direct CDN URL, redirect (302) so the browser fetches it directly
  if (url) {
    return NextResponse.redirect(url, 302)
  }

  // Otherwise return a transparent pixel placeholder
  const svg = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="%23e2e8f0" width="1" height="1"/></svg>`
  return NextResponse.redirect(svg, 302)
}
