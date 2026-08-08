/**
 * Tavily-backed audit runner — used ONLY when the free scraper hits a
 * WAF block (Cloudflare, etc.) and can't get through with direct HTTP.
 *
 * Costs ~2 Tavily credits per call (homepage + /contact).
 * Always falls through gracefully if Tavily is unavailable.
 */

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
if (!TAVILY_API_KEY) {
  throw new Error('TAVILY_API_KEY is not set in the environment');
}

// ── Regexes ─────────────────────────────────────────────────────────────
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}\b/g;
const PHONE_RE =
  /(?<![\d.])(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}(?![\d.])/g;
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
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(15000),
    });
    const body = res.ok ? await res.text() : '';
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

function deNoiseEmails(emails: string[]): string[] {
  return [...new Set(emails)].filter((e) => {
    const lower = e.toLowerCase();
    return (
      !lower.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/) &&
      !lower.includes('example.com') &&
      !lower.includes('yourdomain') &&
      !lower.includes('wixpress') &&
      !lower.includes('sentry.io') &&
      !lower.includes('cloudflare.com')
    );
  });
}

function anyMatch(patterns: RegExp[], text: string): boolean {
  return patterns.some((p) => p.test(text));
}

export interface AuditInput {
  businessId: string;
  businessName: string;
  website: string;
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

  // Direct HEAD/GET homepage
  const homepage = await httpProbe(url);
  result.httpStatus = homepage.status;
  result.finalUrl = homepage.finalUrl;
  result.pageLoadMs = homepage.ms;
  result.contentLength = homepage.body.length;
  result.siteLoads = homepage.status >= 200 && homepage.status < 400;
  result.rawHtml = homepage.body.slice(0, 50000);

  const html = homepage.body;
  result.hasTitle = /<title[^>]*>[^<]+<\/title>/i.test(html);
  result.hasMetaDescription = /<meta\s+name=["']description["']/i.test(html);
  result.hasSingleH1 = (html.match(/<h1\b/gi) || []).length === 1;
  result.hasOpenGraph = /<meta\s+(?:property|name)=["']og:/i.test(html);
  result.hasSchemaOrg =
    /<script\s+type=["']application\/ld\+json["']/i.test(html) ||
    /itemtype=["']https?:\/\/schema\.org/i.test(html);
  result.isMobileFriendly = /<meta\s+name=["']viewport["']/i.test(html);
  result.hasContactForm =
    /<form\b/i.test(html) &&
    /action=["']?(https?:|\/[^"']*|mailto:)/i.test(html);
  result.hasGoogleAnalytics = anyMatch(GA_PATTERNS, html);
  result.hasGoogleTagManager = anyMatch(GTM_PATTERNS, html);
  result.hasMetaPixel = anyMatch(PIXEL_PATTERNS, html);
  result.hasDeprecatedHtml = DEPRECATED_TAGS_RE.test(html);

  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  if (imgTags.length > 0) {
    const withAlt = imgTags.filter((t) => /\salt=["'][^"']+["']/i.test(t)).length;
    result.hasAltTextCoverage = withAlt / imgTags.length >= 0.8;
  }

  // Sitemap + robots.txt
  const origin = parsed.origin;
  const [sitemap, robots] = await Promise.all([
    httpHead(`${origin}/sitemap.xml`),
    httpHead(`${origin}/robots.txt`),
  ]);
  result.hasSitemap = sitemap.ok;
  result.hasRobotsTxt = robots.ok;

  // Tavily Extract for content
  let tavilyContent = '';
  const homepageTavily = await tavilyExtract(url);
  if (homepageTavily.ok) tavilyContent = homepageTavily.content;
  const contactTavily = await tavilyExtract(`${origin}/contact`);
  if (contactTavily.ok) tavilyContent += '\n\n' + contactTavily.content;

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

    result.hasBlog =
      /(\/blog\b|\/news\b|\/articles\b|\bbrowse our blog\b|\bread our blog\b)/i.test(
        tavilyContent
      );

    result.rawSignals.tavilyContentLength = tavilyContent.length;
  }

  // Score
  const tavilySucceeded =
    (result.rawSignals.tavilyContentLength as number) > 0;
  const directBlocked = !result.siteLoads && tavilySucceeded;

  const infra = (() => {
    let s = 0;
    if (result.hasSsl) s += 7;
    if (result.isMobileFriendly) s += 7;
    if (result.siteLoads) s += 6;
    return s;
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
    return s;
  })();

  const conversion =
    (result.hasContactForm ? 10 : 0) + (result.hasVisibleEmail ? 10 : 0);
  const analytics =
    (result.hasGoogleAnalytics ? 10 : 0) +
    (result.hasGoogleTagManager ? 5 : 0) +
    (result.hasMetaPixel ? 5 : 0);
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
    return s;
  })();

  result.score = infra + seo + conversion + analytics + freshness;
  result.rawSignals = {
    ...result.rawSignals,
    infra,
    seo,
    conversion,
    analytics,
    freshness,
    directBlocked,
  };

  return result;
}