/**
 * Extracts video/image media from Instagram using the Meta Graph API.
 *
 * Env vars required (set in Vercel):
 *   META_ACCESS_TOKEN  — long-lived Page Access Token
 *   IG_USER_ID         — numeric Instagram Business/creator account ID
 *
 * Flow:
 *   1. Extract shortcode from the post URL (e.g. "DbOqf6JSK-V" from .../reel/DbOqf6JSK-V/)
 *   2. Resolve shortcode → media ID  (GET /{ig-user-id}/{shortcode})
 *   3. Fetch media details             (GET /{media-id}?fields=...)
 */

export interface MediaExtractResult {
  mediaUrl: string | null  // video URL for VIDEO/REELS, image URL for IMAGE
  thumbnailUrl: string | null // poster/thumbnail (always available)
  mediaType: 'video' | 'image' | null
  caption: string | null
}

// ─── Shortcode utilities ────────────────────────────────────────────────────────

const SHORTCODE_RE = /instagram\.com\/(?:p|reel|tv| reels?)\/([\w-]+)/

/** Pull the shortcode (e.g. "AbCd123") out of an Instagram post URL */
function extractShortcode(postUrl: string): string | null {
  const m = postUrl.match(SHORTCODE_RE)
  return m ? m[1] : null
}

// ─── Graph API helpers ────────────────────────────────────────────────────────

function graphUrl(path: string, params: Record<string, string> = {}): string {
  const base = `https://graph.facebook.com/v18.0${path}`
  const qs = new URLSearchParams({ ...params, access_token: process.env.META_ACCESS_TOKEN! })
  return `${base}?${qs}`
}

async function graphGet<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error('[instagram-media] Graph API error:', err)
      return null
    }
    return res.json() as Promise<T>
  } catch (e) {
    console.error('[instagram-media] fetch failed:', e)
    return null
  }
}

// ─── Step 1: shortcode → numeric media ID ───────────────────────────────────

/** Instagram shortcode endpoint: GET /{ig-user-id}/{shortcode} → { id } */
async function resolveMediaId(shortcode: string): Promise<string | null> {
  const igUserId = process.env.IG_USER_ID
  if (!igUserId) {
    console.error('[instagram-media] IG_USER_ID not set')
    return null
  }
  const url = graphUrl(`/${igUserId}/${shortcode}`)
  const data = await graphGet<{ id?: string; error?: { message: string } }>(url)
  if (!data?.id) return null
  return data.id
}

// ─── Step 2: media ID → full media object ───────────────────────────────────

interface IgMedia {
  id: string
  media_type?: 'VIDEO' | 'IMAGE' | 'CAROUSEL_ALBUM' | 'REELS'
  media_url?: string
  thumbnail_url?: string
  caption?: string
}

/** Fetch fields: media_type, media_url, thumbnail_url, caption */
async function fetchMediaDetails(mediaId: string): Promise<IgMedia | null> {
  const fields = 'id,media_type,media_url,thumbnail_url,caption'
  const url = graphUrl(`/${mediaId}`, { fields })
  return graphGet<IgMedia>(url)
}

// ─── Main extractor ────────────────────────────────────────────────────────────

/**
 * Extract the best available media URL + caption from an Instagram post URL.
 * Returns thumbnail as fallback even if full media URL is unavailable.
 */
export async function extractInstagramMedia(postUrl: string): Promise<MediaExtractResult> {
  const shortcode = extractShortcode(postUrl)
  if (!shortcode) {
    return { mediaUrl: null, thumbnailUrl: null, mediaType: null, caption: null }
  }

  // Step 1: resolve shortcode → media ID
  const mediaId = await resolveMediaId(shortcode)
  if (!mediaId) {
    return { mediaUrl: null, thumbnailUrl: null, mediaType: null, caption: null }
  }

  // Step 2: fetch media details
  const media = await fetchMediaDetails(mediaId)
  if (!media) {
    return { mediaUrl: null, thumbnailUrl: null, mediaType: null, caption: null }
  }

  // Video/reel: prefer media_url (full video), fall back to thumbnail_url
  // Image: use media_url
  const mediaType: 'video' | 'image' | null =
    media.media_type === 'VIDEO' || media.media_type === 'REELS' ? 'video'
    : media.media_type === 'IMAGE' ? 'image'
    : null

  const mediaUrl =
    mediaType === 'video' ? (media.media_url ?? media.thumbnail_url ?? null)
    : media.media_url ?? null

  const thumbnailUrl = media.thumbnail_url ?? null

  return {
    mediaUrl,
    thumbnailUrl,
    mediaType,
    caption: media.caption ?? null,
  }
}

// ─── Convenience: convert numeric media ID → oembed thumbnail (no token needed)
// This is kept as a fallback but is now secondary to the Graph API path.
export async function extractOembedThumbnail(postUrl: string): Promise<string | null> {
  try {
    const url =
      `https://graph.facebook.com/v18.0/instagram_oembed` +
      `?url=${encodeURIComponent(postUrl)}&maxwidth=480&fields=thumbnail_url&omit_xml=true&access_token=${process.env.META_ACCESS_TOKEN}`
    const res = await fetch(url, { next: { revalidate: 86400 } })
    if (!res.ok) return null
    const data = (await res.json()) as { thumbnail_url?: string }
    return data.thumbnail_url ?? null
  } catch {
    return null
  }
}
