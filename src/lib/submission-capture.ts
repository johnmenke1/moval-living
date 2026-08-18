/**
 * submission-capture.ts
 *
 * Captures metadata from the original social media post at submission time.
 * Runs via Playwright (real browser) to get past Instagram's anti-bot layer.
 *
 * What we capture from IG/FB posts:
 *   - thumbnailUrl    (IG og:image URL — won't display due to CDN auth, but
 *                       useful as admin preview + dedupe signal)
 *   - authorHandle    (@handle parsed from the IG profile URL in og:url)
 *   - authorUrl       (full profile URL)
 *   - postCaption     (the actual post text, from og:title/og:description)
 *
 * What we DON'T do here:
 *   - Generate the hero image (that's scripts/generate-event-poster.mts)
 *   - Upload to Vercel Blob (that's the poster script)
 *   - Modify the database (caller does that after we return)
 *
 * The Playwright browser is heavy to spin up (~500ms), so for plain URLs
 * that aren't IG/FB (the OTHER platform case), we skip browser launch
 * entirely and just return nulls.
 */

import { chromium, type Browser } from 'playwright'

export type SubmissionSourcePlatform = 'INSTAGRAM' | 'FACEBOOK' | 'OTHER'

export interface SubmissionCapture {
  /** URL to the original post's media (often IG CDN — auth-gated, won't display). */
  thumbnailUrl: string | null
  /** @handle of the poster, e.g. "world.of.fantasy.events". */
  authorHandle: string | null
  /** Full profile URL, e.g. https://www.instagram.com/world.of.fantasy.events/ */
  authorUrl: string | null
  /** The actual post text — what people wrote about the event. */
  postCaption: string | null
  /** When we fetched it. */
  capturedAt: Date
  /** True if the fetch succeeded. False if IG blocked us, the post is private, etc. */
  success: boolean
}

/** Detect the platform from a URL. Conservative — defaults to OTHER. */
export function detectPlatform(url: string): SubmissionSourcePlatform {
  if (/instagram\.com\//i.test(url)) return 'INSTAGRAM'
  if (/facebook\.com\//i.test(url)) return 'FACEBOOK'
  return 'OTHER'
}

/**
 * Lazy-initialized browser singleton. Spinning up chromium is ~500ms,
 * so we reuse it across multiple submissions when the cron processes
 * a batch.
 */
let browserPromise: Promise<Browser> | null = null

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
  }
  return browserPromise
}

/** Empty capture for failure cases — caller can still create a Submission. */
function emptyCapture(success = false): SubmissionCapture {
  return {
    thumbnailUrl: null,
    authorHandle: null,
    authorUrl: null,
    postCaption: null,
    capturedAt: new Date(),
    success,
  }
}

/**
 * Capture metadata from an Instagram or Facebook post URL.
 * Uses Playwright to render the page (Instagram's HTML anti-bot layer
 * blocks curl, but a real browser gets past it).
 */
export async function captureSubmissionMetadata(
  sourceUrl: string,
  platform: SubmissionSourcePlatform
): Promise<SubmissionCapture> {
  if (platform === 'OTHER') return emptyCapture(false)

  let browser: Browser
  try {
    browser = await getBrowser()
  } catch (err) {
    console.error('[capture] failed to launch browser:', err)
    return emptyCapture(false)
  }

  let context
  try {
    context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    })
    const page = await context.newPage()

    // Use domcontentloaded instead of networkidle — IG's page is a never-
    // ending stream of analytics pings that prevent networkidle from firing.
    await page.goto(sourceUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })

    // Wait for og: meta tags to be populated. They're injected by the
    // initial server-side render so they should be available immediately,
    // but give it a moment for hydration to finish.
    await page.waitForSelector('meta[property="og:title"]', { timeout: 5000 }).catch(() => null)

    const meta = await page.evaluate(() => {
      const get = (prop: string): string | null =>
        document.querySelector(`meta[property="${prop}"]`)?.getAttribute('content') ?? null
      return {
        ogTitle: get('og:title'),
        ogDescription: get('og:description'),
        ogImage: get('og:image'),
        ogUrl: get('og:url'),
      }
    })

    // Extract @handle from og:url. Format: https://www.instagram.com/{handle}/p/{shortcode}/
    const handleMatch = meta.ogUrl?.match(/instagram\.com\/([^/]+)\//)
    const authorHandle = handleMatch ? handleMatch[1] : null
    const authorUrl = meta.ogUrl ?? null

    // The caption is in og:title. Instagram formats it as:
    //   "{handle} on Instagram: \"{caption}\""
    // or for FB: "Title - {likes} likes"
    // We strip the boilerplate to get just the caption text.
    let postCaption: string | null = null
    if (meta.ogTitle) {
      postCaption = meta.ogTitle
      // IG format: "Handle on Instagram: \"caption\""
      const igMatch = meta.ogTitle.match(/on Instagram:\s*"([\s\S]*)"\s*$/)
      if (igMatch) {
        postCaption = igMatch[1]
      }
    }

    // Fall back to og:description if og:title didn't have the caption
    if (!postCaption && meta.ogDescription) {
      // IG format: "X likes, Y comments - handle on date: \"caption\""
      const descMatch = meta.ogDescription.match(/:\s*"([\s\S]*)"\s*\.?\s*$/)
      if (descMatch) {
        postCaption = descMatch[1]
      } else {
        postCaption = meta.ogDescription
      }
    }

    // Last-resort fallbacks for posts where IG is serving a captcha / login
    // wall instead of the real page (which is now common for unauthenticated
    // requests). Without an IG session we can't get the caption text — the
    // page JS doesn't include it in the HTML; it's only hydrated into the
    // DOM after a successful session check. The form should let the user
    // paste it manually.
    if (!postCaption) {
      const nameDescription = await page.evaluate(() =>
        document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
      )
      if (nameDescription) postCaption = nameDescription
    }
    if (!postCaption) {
      const challengeSeen = await page.evaluate(() =>
        document.body.innerText.toLowerCase().includes('captcha') ||
        document.body.innerText.toLowerCase().includes('challenge') ||
        document.body.innerText.toLowerCase().includes('verify your account') ||
        document.body.innerText.toLowerCase().includes('log in'),
      )
      if (challengeSeen) {
        console.warn(
          `[capture] IG served captcha/challenge for ${sourceUrl}; caption not extractable without session.`,
        )
      }
    }

    await context.close()

    return {
      thumbnailUrl: meta.ogImage ?? null,
      authorHandle,
      authorUrl,
      postCaption,
      capturedAt: new Date(),
      success: true,
    }
  } catch (err) {
    console.error('[capture] failed for', sourceUrl, err)
    if (context) await context.close().catch(() => null)
    return emptyCapture(false)
  }
}

/**
 * Close the singleton browser. Call this from a cron session's cleanup.
 * Safe to call multiple times.
 */
export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise
    browserPromise = null
    await browser.close().catch(() => null)
  }
}
