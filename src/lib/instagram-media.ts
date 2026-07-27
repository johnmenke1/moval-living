/**
 * Extracts og:image and og:video (or og:video:url) from an Instagram post URL.
 * Uses HTML scraping — no Meta API token required.
 *
 * Returns { mediaUrl, mediaType } where mediaType is 'video' | 'image' | null
 */

export interface MediaExtractResult {
  mediaUrl: string | null
  mediaType: 'video' | 'image' | null
  caption: string | null
}

/** Check if a URL is actually a video based on common CDN patterns */
function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
}

const INSTAGRAM_POST_REGEX = /instagram\.com\/(p|reel|tv)\/([\w-]+)/

/**
 * Fetch and parse og meta tags from an HTML string.
 */
function extractOgMeta(html: string): Record<string, string> {
  const metas: Record<string, string> = {}
  const re = /<meta\s+(?:property|name)=["'](og:[^"']+)["']\s+content=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    metas[m[1]] = m[2]
  }
  return metas
}

/**
 * Try oEmbed API first (no auth needed for public posts).
 * Returns thumbnail URL or null.
 */
async function tryOembed(postUrl: string): Promise<string | null> {
  try {
    const oembedUrl = `https://graph.facebook.com/v18.0/instagram_oembed?url=${encodeURIComponent(postUrl)}&maxwidth=480&fields=thumbnail_url,author_name& Omitempty`
    const res = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const data = await res.json() as { thumbnail_url?: string }
    return data.thumbnail_url ?? null
  } catch {
    return null
  }
}

/**
 * Scrape og meta tags directly from the Instagram post page.
 * Instagram blocks simple bots — we use a browser-like UA and follow redirects.
 */
async function tryScrape(postUrl: string): Promise<{ mediaUrl: string | null; mediaType: 'video' | 'image' | null; caption: string | null }> {
  try {
    const res = await fetch(postUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    })

    if (!res.ok && res.status !== 200) {
      return { mediaUrl: null, mediaType: null, caption: null }
    }

    const html = await res.text()
    const metas = extractOgMeta(html)

    const mediaUrl =
      metas['og:video:url'] ||
      metas['og:video'] ||
      metas['og:image'] ||
      metas['og:image:url'] ||
      null

    if (!mediaUrl) return { mediaUrl: null, mediaType: null, caption: null }

    const caption = metas['og:description'] || metas['og:title'] || null
    const mediaType: 'video' | 'image' = isVideoUrl(mediaUrl) ? 'video' : 'image'

    return { mediaUrl, mediaType, caption }
  } catch {
    return { mediaUrl: null, mediaType: null, caption: null }
  }
}

/**
 * Extract media URL + type from an Instagram post URL.
 * Strategy: try oEmbed first (fast, reliable), fall back to HTML scraping.
 */
export async function extractInstagramMedia(postUrl: string): Promise<MediaExtractResult> {
  // Validate URL
  const match = postUrl.match(INSTAGRAM_POST_REGEX)
  if (!match) {
    return { mediaUrl: null, mediaType: null, caption: null }
  }

  // Try oEmbed first
  const thumb = await tryOembed(postUrl)
  if (thumb) {
    return { mediaUrl: thumb, mediaType: 'image', caption: null }
  }

  // Fall back to scraping
  const result = await tryScrape(postUrl)
  return result
}
