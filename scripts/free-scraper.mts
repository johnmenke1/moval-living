/**
 * Free first-pass scraper — direct HTTP, no Tavily.
 *
 * Port of Johnny's Python scraper to TypeScript. Uses cheerio for HTML
 * parsing (jQuery-like API, very fast) and native fetch for HTTP.
 *
 * Strategy:
 *   1. GET homepage with realistic Chrome UA
 *   2. Extract emails from mailto: links + body text (with de-obfuscation)
 *   3. Extract social links (FB/IG/LI/X/YT) per platform
 *   4. Detect /contact, /about, /team subpages
 *   5. If no email on homepage, fetch up to 3 subpages looking for email
 *   6. While we're here, also extract the 20 audit signals:
 *      SSL, viewport, title, meta description, H1, sitemap, robots,
 *      schema.org, OG tags, GA/GTM/Pixel, alt text coverage, copyright
 *      year, deprecated HTML, blog presence
 *
 * Returns an AuditResult-shaped payload (compatible with auditBusiness
 * in audit-runner.mts). Saves Tavily credits for businesses that need
 * JS rendering (Cloudflare-blocked or SPA sites).
 */

import * as cheerio from 'cheerio';

// ── Regexes ─────────────────────────────────────────────────────────────
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}(?![a-z])/g;

// Common label prefixes that contact pages concatenate with the email.
// We replace them with a word boundary so the regex can match cleanly:
//   "Emailchris@example.com" → "Email chris@example.com"
//   "E-mail:chris@example.com" → "E-mail: chris@example.com"
//   "Phone(951)555-1234Emailchris@example.com" → "...Email chris@example.com"
const LABEL_BEFORE_EMAIL_RE = /(Email|E-mail|EMAIL|Mail|Contact)\b(?=[a-zA-Z0-9])/g;

const SOCIAL_PATTERNS: Record<string, RegExp> = {
  facebook:
    /(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|fb\.com)\/[a-zA-Z0-9._-]+\/?/i,
  instagram:
    /(?:https?:\/\/)?(?:www\.)?instagram\.com\/[a-zA-Z0-9._-]+\/?/i,
  linkedin:
    /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9._-]+\/?/i,
  twitter:
    /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/[a-zA-Z0-9._-]+\/?/i,
  youtube:
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:@|c\/|user\/)?[a-zA-Z0-9._-]+\/?/i,
};

const IGNORED_EXT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.pdf', '.css', '.js',
]);

const COPYRIGHT_RE = /©\s*(\d{4})|copyright\s*\(?c\)?\s*©?\s*(\d{4})/i;
const DEPRECATED_TAGS_RE =
  /<font\b|<center\b|border=["']?0["']? cellpadding=["']?0["']?/i;
const GA_PATTERNS = [
  /\bgtag\s*\(/,
  /\bUA-\d{4,}-\d+/,
  /\bG-[A-Z0-9]{6,15}/,
  /googletagmanager\.com\/gtag\/js/,
];
const GTM_PATTERNS = [/googletagmanager\.com\/gtm\.js/, /\bGTM-[A-Z0-9]{6,8}/];
const PIXEL_PATTERNS = [/\bfbq\s*\(/, /connect\.facebook\.net\/.*fbevents\.js/];

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

// ── De-obfuscation ──────────────────────────────────────────────────────
// Replace obfuscation like [at], (at), {at}, [AT], [ @ ], etc.
// IMPORTANT: only match when wrapped in brackets/parens — bare "at" in
// normal English words like "negotiate", "rotation", "@ment" must NOT be
// replaced (otherwise "negotiation" becomes "negoti@ion" → false email).
const AT_OBFUSC_RE = /[\(\[\{<]\s*(?:at|AT)\s*[\)\]\}>]/g;
const DOT_OBFUSC_RE = /[\(\[\{<]\s*(?:dot|DOT)\s*[\)\]\}>]/g;
function deobfuscateText(raw: string): string {
  return raw
    .replace(AT_OBFUSC_RE, '@')
    .replace(DOT_OBFUSC_RE, '.');
}

// ── Email extraction ────────────────────────────────────────────────────
function extractEmails($: cheerio.Root): Set<string> {
  const emails = new Set<string>();

  // 1. mailto: links
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    const email = href.replace(/^mailto:/i, '').split('?')[0].trim();
    if (email) emails.add(email.toLowerCase());
  });

  // 2. de-obfuscated body text. Strip script/style/svg/noscript/iframe
  // first because cheerio's .text() includes their text content. We
  // especially need to strip <script type="application/ld+json"> which
  // contains JSON-LD data — its text is JSON-encoded and would corrupt
  // our email extraction (e.g. "741-5311emailchris@leeper.comoffice").
  const $clean = cheerio.load(
    `<body>${$('body').html() ?? ''}</body>`
  );
  $clean('script, style, svg, noscript, iframe').remove();
  let cleaned = deobfuscateText($clean('body').text());
  // Insert word boundaries before common label words that get concatenated
  // with the email in raw text: "Emailchris@..." → "Email chris@..."
  cleaned = cleaned.replace(LABEL_BEFORE_EMAIL_RE, '$& ');
  const matches = cleaned.match(EMAIL_REGEX) || [];
  for (const m of matches) {
    const lower = m.toLowerCase();
    const ext = '.' + lower.split('.').pop();
    if (ext === '' || IGNORED_EXT.has(ext) || lower.includes('example.com')) {
      continue;
    }
    // Strip leading garbage that got concatenated with the local part.
    // Real-world contact pages often have no whitespace between sections:
    //   "Phone(951) 741-5311Emailchris@leeper.com" → "chris@leeper.com"
    // We strip known prefixes (phone numbers, label words) so the local
    // part starts with what looks like a real username.
    let cleanedEmail = lower;
    // 1. Phone-number prefix. Common formats:
    //    (951) 741-5311, 951-741-5311, 741-5311, (951)741-5311
    //    The 951-741-5311 case has area code, 741-5311 is the 7-digit local.
    //    We strip the WHOLE area-code + 7-digit combo when present.
    cleanedEmail = cleanedEmail.replace(
      /^\s*(?:\(\d{3}\)\s*)?\d{3}[-.\s]\d{4}\s*([a-z][a-zA-Z0-9._%+-]*@)/i,
      '$1'
    );
    // 2. If still has "email"/"mail"/"contact" prefix glued to local:
    //    "emailchris@..." → "chris@..."
    cleanedEmail = cleanedEmail.replace(
      /^(email|mail|contact|phone|tel|fax)[\s]*([a-z][a-zA-Z0-9._%+-]*@)/i,
      '$2'
    );
    emails.add(cleanedEmail);
  }

  return emails;
}

// ── Social link extraction ──────────────────────────────────────────────
function extractSocialLinks(
  $: cheerio.Root,
  baseUrl: string
): Record<string, string[]> {
  const found: Record<string, Set<string>> = {};
  for (const platform of Object.keys(SOCIAL_PATTERNS)) {
    found[platform] = new Set();
  }

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    let fullUrl: string;
    try {
      fullUrl = new URL(href, baseUrl).toString().replace(/\/$/, '');
    } catch {
      return;
    }
    for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
      if (pattern.test(fullUrl)) {
        // Filter share/intent/post links
        if (
          !fullUrl.includes('/sharer') &&
          !fullUrl.includes('/intent') &&
          !fullUrl.includes('/share') &&
          !fullUrl.includes('/post') &&
          !fullUrl.includes('/hashtag')
        ) {
          found[platform].add(fullUrl);
        }
      }
    }
  });

  return Object.fromEntries(
    Object.entries(found)
      .filter(([, v]) => v.size > 0)
      .map(([k, v]) => [k, Array.from(v)])
  ) as Record<string, string[]>;
}

// ── Contact subpage discovery ───────────────────────────────────────────
function getContactLinks($: cheerio.Root, baseUrl: string): string[] {
  const keywords = ['contact', 'about', 'get-in-touch', 'team', 'staff'];
  const links = new Set<string>();
  const baseHost = new URL(baseUrl).hostname;

  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') ?? '').toLowerCase();
    if (!keywords.some((k) => href.includes(k))) return;
    let fullUrl: string;
    try {
      fullUrl = new URL($(el).attr('href') ?? '', baseUrl).toString();
    } catch {
      return;
    }
    if (new URL(fullUrl).hostname === baseHost) {
      links.add(fullUrl);
    }
  });

  return Array.from(links).slice(0, 3);
}

// ── HTTP fetch with timeout ─────────────────────────────────────────────
async function httpGet(url: string, timeoutMs = 12000): Promise<{
  ok: boolean;
  status: number;
  finalUrl: string;
  html: string;
  ms: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const html = res.ok ? await res.text() : '';
    return {
      ok: res.ok,
      status: res.status,
      finalUrl: res.url,
      html,
      ms: Date.now() - start,
    };
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      finalUrl: url,
      html: '',
      ms: Date.now() - start,
      error: e.message?.slice(0, 100),
    };
  }
}

async function httpHead(url: string, timeoutMs = 8000): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Audit signal extraction from raw HTML ───────────────────────────────
function auditSignals(html: string, $: cheerio.Root) {
  return {
    hasTitle: $('title').text().trim().length > 0,
    hasMetaDescription:
      ($('meta[name="description"]').attr('content') ?? '').trim().length > 0,
    hasSingleH1: $('h1').length === 1,
    hasOpenGraph: $('meta[property^="og:"]').length > 0,
    hasSchemaOrg:
      $('script[type="application/ld+json"]').length > 0 ||
      $('[itemtype*="schema.org"]').length > 0,
    isMobileFriendly: $('meta[name="viewport"]').length > 0,
    hasContactForm:
      $('form[action]').length > 0 &&
      $('form[action]').filter((_, el) => {
        const a = $(el).attr('action') ?? '';
        return a.startsWith('http') || a.startsWith('/') || a.startsWith('mailto:');
      }).length > 0,
    hasGoogleAnalytics: GA_PATTERNS.some((p) => p.test(html)),
    hasGoogleTagManager: GTM_PATTERNS.some((p) => p.test(html)),
    hasMetaPixel: PIXEL_PATTERNS.some((p) => p.test(html)),
    hasDeprecatedHtml: DEPRECATED_TAGS_RE.test(html),
  };
}

function altTextCoverage($: cheerio.Root): boolean {
  const imgs = $('img');
  if (imgs.length === 0) return false; // No images = N/A, don't claim coverage
  const withAlt = imgs.filter((_, el) => ($(el).attr('alt') ?? '').trim().length > 0).length;
  return withAlt / imgs.length >= 0.8;
}

function extractCopyrightYear(html: string): number | null {
  const m = html.match(COPYRIGHT_RE);
  if (!m) return null;
  const y = parseInt(m[1] || m[2], 10);
  const now = new Date().getFullYear();
  return y >= 2000 && y <= now + 1 ? y : null;
}

function detectBlog($: cheerio.Root): boolean {
  const $clean = cheerio.load(`<body>${$('body').html() ?? ''}</body>`);
  $clean('script, style, svg, noscript').remove();
  const text = $clean('body').text().toLowerCase();
  return (
    /\bbrowse our blog\b|\bread our blog\b|\bvisit our blog\b|\bview all posts\b/.test(
      text
    ) ||
    $('a[href]').filter((_, el) => {
      const href = ($(el).attr('href') ?? '').toLowerCase();
      return /\/blog|\/news|\/articles/.test(href);
    }).length > 0
  );
}

// ── Scoring ─────────────────────────────────────────────────────────────
function scoreSignals(s: {
  hasSsl: boolean;
  isMobileFriendly: boolean;
  siteLoads: boolean;
  hasTitle: boolean;
  hasMetaDescription: boolean;
  hasSingleH1: boolean;
  hasSitemap: boolean;
  hasRobotsTxt: boolean;
  hasSchemaOrg: boolean;
  hasOpenGraph: boolean;
  hasAltTextCoverage: boolean;
  hasContactForm: boolean;
  hasVisibleEmail: boolean;
  hasGoogleAnalytics: boolean;
  hasGoogleTagManager: boolean;
  hasMetaPixel: boolean;
  copyrightYear: number | null;
  hasDeprecatedHtml: boolean;
  hasBlog: boolean;
}) {
  const infra =
    (s.hasSsl ? 7 : 0) + (s.isMobileFriendly ? 7 : 0) + (s.siteLoads ? 6 : 0);
  const seo =
    (s.hasTitle ? 3 : 0) +
    (s.hasMetaDescription ? 3 : 0) +
    (s.hasSingleH1 ? 3 : 0) +
    (s.hasSitemap ? 4 : 0) +
    (s.hasRobotsTxt ? 2 : 0) +
    (s.hasSchemaOrg ? 3 : 0) +
    (s.hasOpenGraph ? 2 : 0);
  const conversion =
    (s.hasContactForm ? 10 : 0) + (s.hasVisibleEmail ? 10 : 0);
  const analytics =
    (s.hasGoogleAnalytics ? 10 : 0) +
    (s.hasGoogleTagManager ? 5 : 0) +
    (s.hasMetaPixel ? 5 : 0);
  const freshness = (() => {
    let f = 0;
    if (s.copyrightYear) {
      const age = new Date().getFullYear() - s.copyrightYear;
      if (age <= 1) f += 8;
      else if (age <= 3) f += 5;
      else if (age <= 5) f += 2;
    }
    if (!s.hasDeprecatedHtml) f += 6;
    if (s.hasBlog) f += 6;
    return f;
  })();
  return { infra, seo, conversion, analytics, freshness, total: infra + seo + conversion + analytics + freshness };
}

// ── Main scraper ────────────────────────────────────────────────────────
export interface FreeScrapeInput {
  businessId: string;
  businessName: string;
  website: string; // already normalized
}

export interface FreeScrapeResult {
  businessId: string;
  httpStatus: number | null;
  finalUrl: string | null;
  error: string | null;
  pageLoadMs: number | null;
  contentLength: number | null;

  hasSsl: boolean;
  isMobileFriendly: boolean;
  siteLoads: boolean;

  hasTitle: boolean;
  hasMetaDescription: boolean;
  hasSingleH1: boolean;
  hasSitemap: boolean;
  hasRobotsTxt: boolean;
  hasSchemaOrg: boolean;
  hasOpenGraph: boolean;
  hasAltTextCoverage: boolean;

  hasContactForm: boolean;
  hasVisibleEmail: boolean;
  foundEmail: string | null;
  foundPhone: string | null;

  hasGoogleAnalytics: boolean;
  hasGoogleTagManager: boolean;
  hasMetaPixel: boolean;

  copyrightYear: number | null;
  hasDeprecatedHtml: boolean;
  hasBlog: boolean;

  score: number;

  rawHtml: string | null;
  rawSignals: Record<string, unknown>;

  // Bonus — captured for free, useful later
  socials: Record<string, string[]>;
  // True if blocked by Cloudflare/WAF and we should fall back to Tavily
  needsTavilyFallback: boolean;
}

export async function freeScrape(
  input: FreeScrapeInput
): Promise<FreeScrapeResult> {
  const url = input.website.startsWith('http')
    ? input.website
    : `https://${input.website}`;
  const parsed = new URL(url);

  const base: FreeScrapeResult = {
    businessId: input.businessId,
    httpStatus: null,
    finalUrl: null,
    error: null,
    pageLoadMs: null,
    contentLength: null,
    hasSsl: parsed.protocol === 'https:',
    isMobileFriendly: false,
    siteLoads: false,
    hasTitle: false,
    hasMetaDescription: false,
    hasSingleH1: false,
    hasSitemap: false,
    hasRobotsTxt: false,
    hasSchemaOrg: false,
    hasOpenGraph: false,
    hasAltTextCoverage: false,
    hasContactForm: false,
    hasVisibleEmail: false,
    foundEmail: null,
    foundPhone: null,
    hasGoogleAnalytics: false,
    hasGoogleTagManager: false,
    hasMetaPixel: false,
    copyrightYear: null,
    hasDeprecatedHtml: false,
    hasBlog: false,
    score: 0,
    rawHtml: null,
    rawSignals: {},
    socials: {},
    needsTavilyFallback: false,
  };

  // ── Homepage ────────────────────────────────────────────────────────
  const homepage = await httpGet(url);
  base.httpStatus = homepage.status;
  base.finalUrl = homepage.finalUrl;
  base.pageLoadMs = homepage.ms;
  base.contentLength = homepage.html.length;
  base.siteLoads = homepage.ok;
  base.error = homepage.error ?? null;

  if (!homepage.ok) {
    // Distinguish "blocked by WAF" (Tavily can help) from "site is dead"
    // (Tavily won't help either — DNS failure means the domain doesn't exist).
    //   - status 0 with no error message: site is dead (DNS or unreachable)
    //   - status 403, 503, 429: blocked by WAF, rate limit, or Cloudflare
    const isBlocked =
      homepage.status === 403 ||
      homepage.status === 429 ||
      homepage.status === 503 ||
      (homepage.status >= 500 && homepage.status < 600);
    base.needsTavilyFallback = isBlocked;
    base.rawSignals.httpError = homepage.status || homepage.error;
    base.rawSignals.fallbackReason = isBlocked
      ? 'waf_or_ratelimit'
      : homepage.status === 0
        ? 'dns_or_unreachable'
        : `http_${homepage.status}`;
    return finalize(base);
  }

  const $ = cheerio.load(homepage.html);
  base.rawHtml = homepage.html.slice(0, 50000);

  // Extract emails + socials from homepage
  let emails = extractEmails($);
  base.socials = extractSocialLinks($, url);

  // Audit signals from HTML
  const sig = auditSignals(homepage.html, $);
  Object.assign(base, sig);
  base.hasAltTextCoverage = altTextCoverage($);
  base.copyrightYear = extractCopyrightYear(homepage.html);
  base.hasBlog = detectBlog($);

  // ── Subpage fallback for missing email ───────────────────────────────
  if (emails.size === 0) {
    const subpageUrls = getContactLinks($, url);
    for (const link of subpageUrls) {
      const sub = await httpGet(link, 8000);
      if (!sub.ok) continue;
      const $sub = cheerio.load(sub.html);
      emails = new Set([...emails, ...extractEmails($sub)]);

      // Also harvest socials from subpages
      const subSocials = extractSocialLinks($sub, link);
      for (const [k, v] of Object.entries(subSocials)) {
        base.socials[k] = [...new Set([...(base.socials[k] || []), ...v])];
      }

      if (emails.size > 0) break;
    }
  }

  if (emails.size > 0) {
    base.foundEmail = Array.from(emails)[0];
    base.hasVisibleEmail = true;
  }

  return finalize(base);
}

function finalize(base: FreeScrapeResult): FreeScrapeResult {
  const score = scoreSignals(base);
  base.score = score.total;
  base.rawSignals = {
    ...base.rawSignals,
    ...score,
  };
  return base;
}