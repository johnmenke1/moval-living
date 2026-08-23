'use client'

/**
 * VoteShareActions — share buttons for /best-of/voted/[voteId].
 *
 * Behavior:
 *   - If navigator.share is available (mobile Safari/Chrome, modern
 *     desktop): use the native share sheet so the user can pick their
 *     preferred target (iMessage, Twitter, FB, Slack, email, etc.)
 *   - Otherwise: show explicit "Copy link" + "Share on X" + "Email"
 *     buttons. The copy-link button falls back to navigator.clipboard
 *     and degrades to document.execCommand('copy') on older browsers.
 *
 * iOS Safari gotcha: navigator.share() must be called synchronously in
 * the user-gesture handler — no awaits before it. We capture all values
 * before the call.
 */

import { useState } from 'react'
import { Share2, Link as LinkIcon, Check, Send, Mail } from 'lucide-react'

interface VoteShareActionsProps {
  pageUrl: string
  shareMessage: string
  voteId: string
}

export function VoteShareActions({
  pageUrl,
  shareMessage,
  voteId,
}: VoteShareActionsProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(pageUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input')
      input.value = pageUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function handleNativeShare() {
    // Must be synchronous — iOS Safari bails if there's an await before
    // the share() call. Capture everything first.
    if (typeof navigator === 'undefined' || !navigator.share) return
    try {
      await navigator.share({
        title: 'Best Of MoVal',
        text: shareMessage,
        url: pageUrl,
      })
    } catch (err) {
      // User cancelled — silent
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[VoteShareActions] share failed:', err)
      }
    }
  }

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(pageUrl)}`
  const mailtoUrl = `mailto:?subject=${encodeURIComponent('Best Of MoVal')}&body=${encodeURIComponent(`${shareMessage}\n\n${pageUrl}`)}`
  const hasNativeShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <div className="space-y-3">
      {hasNativeShare && (
        <button
          type="button"
          onClick={handleNativeShare}
          className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-br from-[#007a7f] to-[#00405c] text-white font-semibold py-3 rounded-xl hover:shadow-lg hover:from-[#008a8f] hover:to-[#00556e] transition-all"
        >
          <Share2 className="w-4 h-4" />
          Share your vote
        </button>
      )}

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-text font-medium py-2.5 rounded-xl text-sm hover:bg-slate-50 hover:border-slate-300 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-600" />
              Copied
            </>
          ) : (
            <>
              <LinkIcon className="w-4 h-4" />
              Copy
            </>
          )}
        </button>
        <a
          href={twitterUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-text font-medium py-2.5 rounded-xl text-sm hover:bg-slate-50 hover:border-slate-300 transition-colors"
        >
          <Send className="w-4 h-4" />
          Post
        </a>
        <a
          href={mailtoUrl}
          className="inline-flex items-center justify-center gap-1.5 bg-white border border-slate-200 text-text font-medium py-2.5 rounded-xl text-sm hover:bg-slate-50 hover:border-slate-300 transition-colors"
        >
          <Mail className="w-4 h-4" />
          Email
        </a>
      </div>

      {/* Hidden semantic marker for the OG image renderer (Task 13) */}
      <span className="sr-only" data-vote-id={voteId}>
        {shareMessage}
      </span>
    </div>
  )
}
