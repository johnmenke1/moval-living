/**
 * Single-business audit runner.
 *
 * Combines two signal sources:
 *   1. Direct HTTP probes (HEAD/GET) — SSL, meta tags, scripts, sitemaps
 *   2. Tavily Extract (advanced) — content, emails, phones, copyright year
 *
 * Returns a complete BusinessAudit-ready payload + the score.
 *
 * Designed to be cheap to invoke: ~2 Tavily credits per business
 * (homepage + /contact) + 4 direct HTTP requests (HEAD + GET + sitemap
 * + robots). Tavily dominates the cost.
 */

const TAVILY_API_KEY = process.env.TAVILY_API_KEY!;
if (!TAVILY_API_KEY) {
  throw new Error('TAVILY_API_KEY is not set in the environment');
}

// ── Regexes ─────────────────────────────────────────────────────────────
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
// Phone: must look like a real phone — North American 10-digit with
// separators, or tel: link. NOT bare 10-digit numbers which match lat/long.
// Negative lookbehind/ahead avoid decimal coordinates like "117.2305651".
const PHONE_RE =
  /(?<![\d.])(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?![\d.])/g;
const COPYRIGHT_RE = /©\s*(\d{4})|copyright\s*\(?c\)?\s*©?\s*(\d{4})/i;
const DEPRECATED_TAGS_RE = /<font\b|<center\b|border=["']?0["']? cellpadding=["']?0["']?/i;
// Common GA/GTM/Pixel patterns (we'll check both raw HTML and patterns)
const GA_PATTERNS = [
  /\bgtag\s*\(/,
  /\bUA-\d{4,}-\d+/,
  /\bG-[A-Z0-9]{6,15}/,
  /googletagmanager\.com\/gtag\/js/,
];
const GTM_PATTERNS = [/googletagmanager\.com\/gtm\.js/, /\bGTM-[A-Z0-9]{6,8}/];
const PIXEL_PATTERNS = [/\bfbq\s*\(/, /connect\.facebook\.net\/.*fbevents\.js/];

// ── Tavily extract ──────────────────────────────────────────────────────
async function tavilyExtract(url: string): Promise<{
  content: string;
  ok: boolean;
}> {
  try {
    const res = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        urls: [url],
        extract_depth: 'advanced',
        include_images: false,
      }),
    });
    if (!res.ok) return { content: '', ok: false };
    const data = await res.json();
    const r = data.results?.[0];
    return { content: r?.raw_content ?? '', ok: !!r };
  } catch {
    return { content: '', ok: false };
  }
}

// ── Direct HTTP probes ──────────────────────────────────────────────────
async function httpProbe(url: string): Promise<{
  status: number;
  finalUrl: string;
  body: string;
  ms: number;
}> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        // Realistic Chrome UA helps avoid 403 from Cloudflare/bot filters
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(15000), // 15s cap
    });
    const body = res.ok
      ? await res.text()
      : '';
    return {
      status: res.status,
      finalUrl: res.url,
      body,
      ms: Date.now() - start,
    };
  } catch (e: any) {
    return { status: 0, finalUrl: url, body: '', ms: Date.now() - start };
  }
}

async function httpHead(url: string): Promise<{ status: number; ok: boolean }> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });
    return { status: res.status, ok: res.ok };
  } catch {
    return { status: 0, ok: false };
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────
function deNoiseEmails(emails: string[]): string[] {
  return [...new Set(emails)].filter((e) => {
    const lower = e.toLowerCase();
    return (
      !lower.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/) &&
      !lower.includes('example.com') &&
      !lower.includes('yourdomain') &&
      !lower.includes('wixpress') &&
      !lower.includes('sentry.io') &&
      !lower.includes('cloudflare.com') &&
      !lower.includes('@2x.png') &&
      !lower.includes('schema.org')
    );
  });
}

function anyMatch(patterns: RegExp[], text: string): boolean {
  return patterns.some((p) => p.test(text));
}

// ── Main audit ──────────────────────────────────────────────────────────
export interface AuditInput {
  businessId: string;
  businessName: string;
  website: string; // already normalized (https://...)
}

export interface AuditResult {
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
}

export async function auditBusiness(input: AuditInput): Promise<AuditResult> {
  const url = input.website.startsWith('http')
    ? input.website
    : `https://${input.website}`;
  const parsed = new URL(url);

  const result: AuditResult = {
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
  };

  // ── 1. Direct HEAD/GET homepage ───────────────────────────────────────
  const homepage = await httpProbe(url);
  result.httpStatus = homepage.status;
  result.finalUrl = homepage.finalUrl;
  result.pageLoadMs = homepage.ms;
  result.contentLength = homepage.body.length;
  result.siteLoads = homepage.status >= 200 && homepage.status < 400;
  result.rawHtml = homepage.body.slice(0, 50000); // cap at 50KB

  const html = homepage.body.toLowerCase();
  result.hasTitle = /<title[^>]*>[^<]+<\/title>/i.test(homepage.body);
  result.hasMetaDescription = /<meta\s+name=["']description["']/i.test(
    homepage.body
  );
  result.hasSingleH1 = (homepage.body.match(/<h1\b/gi) || []).length === 1;
  result.hasOpenGraph = /<meta\s+(?:property|name)=["']og:/i.test(
    homepage.body
  );
  result.hasSchemaOrg = /<script\s+type=["']application\/ld\+json["']/i.test(
    homepage.body
  ) || /itemtype=["']https?:\/\/schema\.org/i.test(homepage.body);
  result.isMobileFriendly = /<meta\s+name=["']viewport["']/i.test(
    homepage.body
  );
  result.hasContactForm =
    /<form\b/i.test(homepage.body) &&
    /action=["']?(https?:|\/[^"']*|mailto:)/i.test(homepage.body);
  result.hasGoogleAnalytics = anyMatch(GA_PATTERNS, homepage.body);
  result.hasGoogleTagManager = anyMatch(GTM_PATTERNS, homepage.body);
  result.hasMetaPixel = anyMatch(PIXEL_PATTERNS, homepage.body);
  result.hasDeprecatedHtml = DEPRECATED_TAGS_RE.test(homepage.body);

  // Alt-text coverage: ratio of <img> tags with non-empty alt attr
  const imgTags = homepage.body.match(/<img\b[^>]*>/gi) || [];
  if (imgTags.length > 0) {
    const withAlt = imgTags.filter((t) => /\salt=["'][^"']+["']/i.test(t)).length;
    result.hasAltTextCoverage = withAlt / imgTags.length >= 0.8;
  }

  // ── 2. Sitemap + robots.txt ───────────────────────────────────────────
  const origin = parsed.origin;
  const [sitemap, robots] = await Promise.all([
    httpHead(`${origin}/sitemap.xml`),
    httpHead(`${origin}/robots.txt`),
  ]);
  result.hasSitemap = sitemap.ok;
  result.hasRobotsTxt = robots.ok;

  // ── 3. Tavily extract (homepage + /contact attempt) ───────────────────
  let tavilyContent = '';
  const homepageTavily = await tavilyExtract(url);
  if (homepageTavily.ok) {
    tavilyContent = homepageTavily.content;
  }

  // Try /contact for a deeper email pull
  const contactTavily = await tavilyExtract(`${origin}/contact`);
  if (contactTavily.ok) {
    tavilyContent += '\n\n' + contactTavily.content;
  }

  if (tavilyContent) {
    const emails = deNoiseEmails(tavilyContent.match(EMAIL_RE) || []);
    const phones = tavilyContent.match(PHONE_RE) || [];

    if (emails.length > 0 && emails[0]) {
      result.foundEmail = emails[0];
      result.hasVisibleEmail = true;
    }
    if (phones.length > 0 && phones[0]) {
      result.foundPhone = phones[0];
    }

    const cpMatch = tavilyContent.match(COPYRIGHT_RE);
    if (cpMatch) {
      const year = parseInt(cpMatch[1] || cpMatch[2], 10);
      if (year >= 2000 && year <= new Date().getFullYear() + 1) {
        result.copyrightYear = year;
      }
    }

    result.hasBlog = /(\/blog\b|\/news\b|\/articles\b|\bbrowse our blog\b|\bread our blog\b)/i.test(
      tavilyContent
    );

    result.rawSignals.tavilyContentLength = tavilyContent.length;
  }

  // ── 4. Score computation ──────────────────────────────────────────────
  // Weighted across 5 categories. Max 100.
  //
  // Cloudflare-protected sites return 403 from our direct probes but
  // Tavily still extracts content (we got 19KB from doughbowlpizza.com).
  // We adapt scoring: if direct HTTP failed but Tavily succeeded, we
  // don't punish technical signals we couldn't verify — we just don't
  // award them.
  const tavilySucceeded =
    (result.rawSignals.tavilyContentLength as number) > 0;
  const directBlocked = !result.siteLoads && tavilySucceeded;

  const infra = (() => {
    let s = 0;
    if (result.hasSsl) s += 7; // Verified from URL, not blocked by 403
    if (result.isMobileFriendly) s += 7;
    if (result.siteLoads) s += 6;
    else if (directBlocked) s += 0; // Can't verify, don't award
    return s; // max 20
  })();

  const seo = (() => {
    let s = 0;
    if (result.hasTitle) s += 3;
    if (result.hasMetaDescription) s += 3;
    if (result.hasSingleH1) s += 3;
    if (result.hasSitemap) s += 4;
    if (result.hasRobotsTxt) s += 2;
    if (result.hasSchemaOrg) s += 3;
    if (result.hasOpenGraph) s += 2;
    return s; // max 20
  })();

  const conversion =
    (result.hasContactForm ? 10 : 0) +
    (result.hasVisibleEmail ? 10 : 0); // max 20

  const analytics =
    (result.hasGoogleAnalytics ? 10 : 0) +
    (result.hasGoogleTagManager ? 5 : 0) +
    (result.hasMetaPixel ? 5 : 0); // max 20

  const freshness = (() => {
    let s = 0;
    if (result.copyrightYear) {
      const age = new Date().getFullYear() - result.copyrightYear;
      if (age <= 1) s += 8;
      else if (age <= 3) s += 5;
      else if (age <= 5) s += 2;
    }
    if (!result.hasDeprecatedHtml) s += 6;
    if (result.hasBlog) s += 6;
    return s; // max 20
  })();

  result.score = infra + seo + conversion + analytics + freshness;
  result.rawSignals = {
    ...result.rawSignals,
    infra,
    seo,
    conversion,
    analytics,
    freshness,
  };

  return result;
}