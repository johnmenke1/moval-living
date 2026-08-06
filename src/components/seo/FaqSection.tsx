'use client'

import { useState } from 'react'
import Script from 'next/script'

export interface FaqItem {
  question: string
  answer: string
}

interface FaqSectionProps {
  faqs: FaqItem[]
  title?: string
  subtitle?: string
}

export function FaqSection({ faqs, title = 'Frequently Asked Questions', subtitle }: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (!faqs || faqs.length === 0) return null

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }

  return (
    <section className="bg-slate-50 py-12">
      <div className="container-max">
        {(title || subtitle) && (
          <div className="mb-8">
            {title && <h2 className="text-2xl font-bold text-text mb-2">{title}</h2>}
            {subtitle && <p className="text-text-secondary">{subtitle}</p>}
          </div>
        )}

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
                    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
      </div>

      {/* FAQPage JSON-LD */}
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </section>
  )
}
