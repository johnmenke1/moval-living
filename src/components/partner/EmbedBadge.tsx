'use client'

import { useState } from 'react'
import { Copy, Check, Code2 } from 'lucide-react'

/**
 * EmbedBadge — owner-only UI that shows copy-paste HTML for the
 * Founding Partner / Expert Partner badge. Hidden from public visitors.
 *
 * The endpoint at /api/partners/badge/[slug] returns an SVG so it can
 * be embedded with a plain <img> tag. We show the owner two sizes
 * (banner / square) with both light and dark theme variants.
 */
interface EmbedBadgeProps {
  partnerSlug: string
  partnerName: string
}

export function EmbedBadge({ partnerSlug, partnerName }: EmbedBadgeProps) {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(label: string, text: string) {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(label)
        setTimeout(() => setCopied(null), 2000)
      },
      () => {
        // Fallback for environments without clipboard API
        const ta = document.createElement('textarea')
        ta.value = text
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
        setCopied(label)
        setTimeout(() => setCopied(null), 2000)
      }
    )
  }

  const baseUrl = 'https://www.moval.living'
  const variants: Array<{
    label: string
    size: 'banner' | 'square'
    theme: 'light' | 'dark'
    width: number
    height: number
  }> = [
    { label: 'Banner (light)', size: 'banner', theme: 'light', width: 600, height: 140 },
    { label: 'Banner (dark)', size: 'banner', theme: 'dark', width: 600, height: 140 },
    { label: 'Square (light)', size: 'square', theme: 'light', width: 320, height: 320 },
    { label: 'Square (dark)', size: 'square', theme: 'dark', width: 320, height: 320 },
  ]

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-2">
        <Code2 className="w-5 h-5 text-[#007a7f]" />
        <h2 className="text-lg font-bold text-[#1a2e35]">Embed your Expert Partner badge</h2>
      </div>
      <p className="text-sm text-[#5a6c72] mb-5">
        Drop one of these snippets on your website — it links back to your moval.living
        page so visitors can verify you and you get the SEO + cross-traffic benefit.
      </p>

      <div className="space-y-5">
        {variants.map((v) => {
          const src = `${baseUrl}/api/partners/badge/${partnerSlug}?size=${v.size}&theme=${v.theme}`
          const snippet = `<a href="${baseUrl}/partners/${partnerSlug}">
  <img src="${src}"
       alt="${escapeAttr(`${partnerName} — Moreno Valley Expert Partner`)}"
       width="${v.width}" height="${v.height}" />
</a>`
          const key = `${v.size}-${v.theme}`
          return (
            <div key={key} className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 flex items-center justify-between border-b border-slate-200">
                <span className="text-sm font-semibold text-[#1a2e35]">{v.label}</span>
                <button
                  type="button"
                  onClick={() => copy(key, snippet)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-[#007a7f] hover:text-[#00405c] transition-colors"
                >
                  {copied === key ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy HTML
                    </>
                  )}
                </button>
              </div>
              <div className="bg-slate-100 px-4 py-3 flex items-center justify-center min-h-[80px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`${partnerName} — Moreno Valley Expert Partner`}
                  width={v.width}
                  height={v.height}
                  className="max-w-full h-auto"
                />
              </div>
              <pre className="bg-slate-900 text-slate-100 text-xs p-3 overflow-x-auto leading-relaxed">
                <code>{snippet}</code>
              </pre>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}