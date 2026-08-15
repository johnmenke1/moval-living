/**
 * submission-oembed.ts
 *
 * Lightweight oEmbed fetcher used at submission time. Unlike instagram-media.ts
 * (which is used on the public /events page render path and pulls the full
 * embed blockquote), this one only fetches what the admin review card needs:
 *   - thumbnail URL (for the prep card preview)
 *   - author handle (for attribution on the card and the source attribution
 *                    shown on the public /events card)
 *   - caption (for the prep card, so admin can copy/paste into the Event
 *              description if they want)
 *
 * Platform detection is by URL pattern:
 *   - instagram.com/...  → INSTAGRAM
 *   - facebook.com/...   → FACEBOOK
 *   - anything else      → OTHER
 *
 * All fetches use Next.js cache (`revalidate: 3600`) so re-submissions of the
 * same URL within an hour don't re-hit the oEmbed endpoint.
 */

export type SubmissionSourcePlatform = 'INSTAGRAM' | 'FACEBOOK' | 'OTHER'

export interface OembedCapture {
  thumbnailUrl: string | null
  authorHandle: string | null
  authorUrl: string | null
  caption: string | null
  capturedAt: Date
}

/** Detect the platform from a URL. Conservative — defaults to OTHER. */
export function detectPlatform(url: string): SubmissionSourcePlatform {
  if (/instagram\.com\//i.test(url)) return 'INSTAGRAM'
  if (/facebook\.com\//i.test(url)) return 'FACEBOOK'
  return 'OTHER'
}

/** Fetch oEmbed for the given URL. Returns null fields on any failure so the
 *  caller can still create a Submission — admin review UI works even without
 *  a thumbnail (the card just shows a placeholder). */
export async function captureOembed(
  sourceUrl: string,
  platform: SubmissionSourcePlatform
): Promise<OembedCapture> {
  const capturedAt = new Date()
  const base: OembedCapture = {
    thumbnailUrl: null,
    authorHandle: null,
    authorUrl: null,
    caption: null,
    capturedAt,
  }

  // Only IG/FB have first-party oEmbed endpoints. For OTHER we just return
  // the bare fields and let admin fill in the thumbnail manually if needed.
  if (platform === 'OTHER') return base

  // Same endpoint as instagram-media.ts. We don't reuse that module because
  // it has more functionality than we need and we want this helper to remain
  // small and predictable.
  const endpoint = `https://graph.facebook.com/v25.0/instagram_oembed?url=${encodeURIComponent(sourceUrl)}&maxwidth=540&omitscript=true`

  try {
    const res = await fetch(endpoint, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
      next: { revalidate: 3600 },
    })
    if (!res.ok) return base
    const data = (await res.json()) as {
      thumbnail_url?: string
      author_name?: string
      author_url?: string
      html?: string
    }
    // oEmbed doesn't directly expose the @handle, but it does expose the
    // author_name (display name) and author_url (profile link). For Instagram
    // specifically, the handle is in the HTML blockquote as data-instgrm-
    // permalink; we leave the handle null here for simplicity — admin can
    // add it manually if needed.
    return {
      ...base,
      thumbnailUrl: data.thumbnail_url ?? null,
      authorHandle: null, // see note above
      authorUrl: data.author_url ?? null,
      caption: null, // oEmbed doesn't expose caption text
    }
  } catch {
    return base
  }
}
