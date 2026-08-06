// Safe markdown → HTML for guest post bodies.
//
// We trust the author enough to render their markdown, but we DO NOT trust
// the rendered HTML — escape unsafe URLs (javascript:, data:, vbscript:),
// strip <script>/<style>/<iframe>/etc. This is intentionally not a full
// sanitizer — we use a strict allowlist for tags and rely on URL filtering
// for the rest. For a higher-traffic site, swap in DOMPurify or rehype-sanitize.

import { marked } from 'marked'

// Allowlist of tags we'll render. Anything else gets its tag stripped but
// its text content preserved.
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'sub', 'sup',
  'ul', 'ol', 'li',
  'blockquote',
  'a',
  'img',
  'code', 'pre',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'figure', 'figcaption',
])

// Attributes allowed per tag.
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'rel', 'target']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  th: new Set(['scope', 'colspan', 'rowspan']),
  td: new Set(['colspan', 'rowspan']),
}

// Protocols allowed in href / src.
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function renderMarkdown(input: string): string {
  if (!input) return ''

  // Configure marked
  // breaks: false → single newlines inside a paragraph render as a space
  // (CommonMark). Paragraphs separated by a blank line become separate <p>
  // tags with proper spacing from Tailwind prose. We previously had
  // breaks: true, which made every newline a <br> — that collapsed visual
  // spacing and broke paragraph separation for pasted rich content.
  marked.setOptions({
    gfm: true,
    breaks: false,
    pedantic: false,
  })

  const raw = marked.parse(input, { async: false }) as string
  return sanitize(promoteImplicitHeadings(raw))
}

// Detect implicit headings — short standalone lines that look like titles.
// Authors commonly write section headers as:
//
//     Place Name
//     Description that continues on the next line...
//
// without bothering to add `#` markdown. Without help, marked wraps both
// lines into a single <p> (because CommonMark single newlines are spaces).
// We split such paragraphs into an <h2> + <p> pair.
//
// Heuristics for "looks like a heading":
//   - Length <= 80 chars
//   - No terminal punctuation (.!?:)
//   - <= 12 words
//   - Doesn't start with a markdown char (#, *, -, >)
//   - Has a continuation on a second line within the same paragraph
//     (i.e. someone wrote name + description on consecutive lines)
function promoteImplicitHeadings(html: string): string {
  // Pattern A: short paragraph immediately followed by another <p>
  // (the easy case — blank line between title and body)
  html = html.replace(
    /<p>([^<]{1,80})<\/p><p>([^<]{1,500})/g,
    (match, title, body) => {
      if (looksLikeHeading(title)) {
        return `<h2>${escapeHeadingText(title)}</h2><p>${body}`
      }
      return match
    }
  )

  // Pattern B: short first line followed by continuation within same <p>
  // (the harder case — author wrote title and description on consecutive
  // lines with only a single \n between them, which marked joins into one
  // <p>). The text inside the <p> is one or more HTML-escaped words/lines.
  html = html.replace(
    /<p>([\s\S]{1,400}?)<\/p>/g,
    (match, inner) => {
      // Look for a short first "line" (no <br>) followed by more content.
      // We split on the first literal newline character (text node inside <p>).
      const nlIdx = inner.indexOf('\n')
      if (nlIdx === -1) return match
      const firstLine = inner.slice(0, nlIdx).trim()
      const rest = inner.slice(nlIdx + 1).trim()
      if (!firstLine || !rest) return match
      if (!looksLikeHeading(firstLine)) return match
      // Reject if there are inline tags inside the first line that suggest
      // it's actual formatted content (e.g. a link or bold)
      if (/<(strong|em|a|code|img)/i.test(firstLine)) return match
      return `<h2>${escapeHeadingText(firstLine)}</h2><p>${rest}</p>`
    }
  )

  return html
}

function looksLikeHeading(text: string): boolean {
  const trimmed = text.trim()
  if (trimmed.length === 0 || trimmed.length > 80) return false
  // No terminal punctuation
  if (/[.!?:,]$/.test(trimmed)) return false
  // Not too long — headings are usually short
  if (trimmed.split(/\s+/).length > 12) return false
  // Doesn't start with markdown syntax
  if (/^[#*\->]/.test(trimmed)) return false
  return true
}

// Headings are plain text — strip any tags that snuck in and escape entities.
function escapeHeadingText(text: string): string {
  return text.replace(/<[^>]+>/g, '').trim()
}

function sanitize(html: string): string {
  // Run two passes:
  //   1. Strip script/style/iframe/object/embed entirely (with content).
  //   2. Walk the remaining HTML and rewrite tags/attrs to the allowlist.
  // This is intentionally conservative — easier to be too restrictive
  // and lift restrictions later than the reverse.

  let safe = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*\/?>/gi, '')
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, '')
    // Inline event handlers and javascript: URLs in attributes
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*"\s*javascript:[^"]*"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'\s*javascript:[^']*'/gi, "$1='#'")
    .replace(/(href|src)\s*=\s*"\s*data:[^"]*"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'\s*data:[^']*'/gi, "$1='#'")
    .replace(/(href|src)\s*=\s*"\s*vbscript:[^"]*"/gi, '$1="#"')

  // Walk and rewrite tags. Use a simple regex-based approach — good enough
  // for our restricted tag set.
  safe = safe.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, slash, tag, attrs) => {
    const lower = tag.toLowerCase()
    if (!ALLOWED_TAGS.has(lower)) {
      // Strip the tag but keep its content. For closing tags, just drop.
      return ''
    }
    const allowedAttrs = ALLOWED_ATTRS[lower]
    if (!allowedAttrs) {
      // Self-closing tag with no allowed attrs
      if (slash) return `</${lower}>`
      return `<${lower}>`
    }
    // Filter attributes
    const filtered: string[] = []
    const attrRegex = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
    let m
    while ((m = attrRegex.exec(attrs)) !== null) {
      const name = m[1].toLowerCase()
      const value = m[2] ?? m[3] ?? m[4] ?? ''
      if (!allowedAttrs.has(name)) continue
      // URL attrs: check protocol
      if ((name === 'href' || name === 'src') && value) {
        try {
          // Relative URLs allowed
          if (value.startsWith('/') || value.startsWith('#')) {
            filtered.push(`${name}="${escapeAttr(value)}"`)
            continue
          }
          const u = new URL(value)
          if (!ALLOWED_PROTOCOLS.has(u.protocol)) continue
        } catch {
          continue
        }
      }
      filtered.push(`${name}="${escapeAttr(value)}"`)
    }
    const attrStr = filtered.length ? ' ' + filtered.join(' ') : ''
    if (slash) return `</${lower}>`
    return `<${lower}${attrStr}>`
  })

  return safe
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}