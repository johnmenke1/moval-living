import { FaqAccordion, type FaqItem } from './FaqAccordion'

export type { FaqItem } from './FaqAccordion'

interface FaqSectionProps {
  faqs: FaqItem[]
  title?: string
  subtitle?: string
}

/**
 * Server-rendered FAQ section. Emits Schema.org FAQPage JSON-LD in the
 * initial HTML (visible to AI crawlers that don't execute client JS) and
 * delegates the accordion interaction to the client child component.
 */
export function FaqSection({ faqs, title = 'Frequently Asked Questions', subtitle }: FaqSectionProps) {
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

        <FaqAccordion faqs={faqs} />
      </div>

      {/* FAQPage JSON-LD — server-rendered so AI crawlers see it in raw HTML. */}
      <script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </section>
  )
}
