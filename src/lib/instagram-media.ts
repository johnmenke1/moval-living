/**
 * Extracts media metadata from an Instagram post URL using Meta's public
 * oEmbed endpoint (tokenless, works for any public post — no Graph API
 * token or account ownership required).
 *
 * Returns:
 *   - mediaUrl: best available thumbnail or video URL from og:image / og:video
 *     scraped from the public Instagram post page. May be null if the page
 *     requires login to view.
 *   - mediaType: 'video' | 'image' | null
 *   - caption: og:description or og:title
 *   - oembedHtml: official Instagram embed blockquote (works for any public
 *     post; pass to EmbedScript for rendering).
 *
 * NOTE: We do NOT use the Meta Graph API (requires META_ACCESS_TOKEN +
 * IG_USER_ID) because that endpoint can only read media owned by the token's
 * Instagram account — which is incompatible with a community-events page
 * that surfaces posts from many different businesses.
 */

export interface MediaExtractResult {
  mediaUrl: string | null
  mediaType: 'video' | 'image' | null
  caption: string | null
  oembedHtml: string | null
}

const SHORTCODE_RE = /instagram\.com\/(?:p|reel|tv|reels?)\/([\w-]+)/

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)
}

/** Pull the shortcode out of an Instagram post URL. */
export function extractShortcode(postUrl: string): string | null {
  const m = postUrl.match(SHORTCODE_RE)
  return m ? m[1] : null
}

/**
 * Step 1: oEmbed — returns the official Instagram embed blockquote.
 * Endpoint: GET https://graph.facebook.com/v25.0/instagram_oembed?url=...
 * Tokenless, returns 200 for any public Instagram post.
 */
async function tryOembed(postUrl: string): Promise<{ html: string; width: number } | null> {
  try {
    const url = `https://graph.facebook.com/v25.0/instagram_oembed?url=${encodeURIComponent(postUrl)}&maxwidth=540&omitscript=true`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return null
    const data = (await res.json()) as { html?: string; width?: number }
    if (!data.html) return null
    return { html: data.html, width: data.width ?? 540 }
  } catch {
    return null
  }
}

/** Parse og: meta tags out of an HTML string. */
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
 * Step 2: HTML scrape — fetches the public Instagram page and pulls
 * og:video / og:image. Best-effort; Instagram often serves a login wall
 * to non-browser UAs, in which case this returns null.
 */
async function tryScrape(postUrl: string): Promise<{
  mediaUrl: string | null
  mediaType: 'video' | 'image' | null
  caption: string | null
}> {
  try {
    const res = await fetch(postUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    })
    if (!res.ok) return { mediaUrl: null, mediaType: null, caption: null }

    const html = await res.text()
    const metas = extractOgMeta(html)

    const mediaUrl =
      metas['og:video:url'] || metas['og:video'] || metas['og:image'] || metas['og:image:url'] || null
    if (!mediaUrl) return { mediaUrl: null, mediaType: null, caption: null }

    const caption = metas['og:description'] || metas['og:title'] || null
    const mediaType: 'video' | 'image' = isVideoUrl(mediaUrl) ? 'video' : 'image'

    return { mediaUrl, mediaType, caption }
  } catch {
    return { mediaUrl: null, mediaType: null, caption: null }
  }
}

/**
 * Extract media metadata from an Instagram post URL.
 *
 * Tries oEmbed first (always works for public posts), then HTML scrape
 * (best-effort, often blocked by Instagram's anti-bot). Returns the
 * official Instagram embed HTML in oembedHtml so callers can render a
 * real Instagram embed when there's no direct mediaUrl.
 */
export async function extractInstagramMedia(postUrl: string): Promise<MediaExtractResult> {
  // Validate first
  if (!extractShortcode(postUrl)) {
    return { mediaUrl: null, mediaType: null, caption: null, oembedHtml: null }
  }

  // Step 1: oEmbed (always works for public posts; gives us the embed block)
  const oembed = await tryOembed(postUrl)
  const oembedHtml = oembed?.html ?? null

  // Step 2: HTML scrape for the actual media URL (thumbnail or video)
  const scraped = await tryScrape(postUrl)

  return {
    mediaUrl: scraped.mediaUrl,
    mediaType: scraped.mediaType,
    caption: scraped.caption,
    oembedHtml,
  }
}