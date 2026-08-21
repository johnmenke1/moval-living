'use client'

import { useState } from 'react'

export interface FaqItem {
  question: string
  answer: string
}

interface FaqAccordionProps {
  faqs: FaqItem[]
}

/**
 * Client-only interactive layer for FaqSection. The FAQPage JSON-LD is
 * emitted from the server-side FaqSection wrapper so it lands in the
 * initial HTML and is visible to AI crawlers (GPTBot, ClaudeBot,
 * PerplexityBot) that don't execute client JavaScript.
 */
export function FaqAccordion({ faqs }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="max-w-2xl space-y-3">
      {faqs.map((faq, i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-slate-200 overflow-hidden"
        >
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 transition-colors"
            aria-expanded={openIndex === i}
          >
            <span className="font-medium text-text text-sm">{faq.question}</span>
            <span
              className={`shrink-0 text-primary transition-transform duration-200 ${
                openIndex === i ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 6L8 10L12 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>

          {openIndex === i && (
            <div className="px-5 pb-4 text-sm text-text-secondary leading-relaxed border-t border-slate-100 pt-3">
              {faq.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
