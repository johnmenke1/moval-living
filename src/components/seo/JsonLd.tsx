'use client'

import Script from 'next/script'

interface JsonLdProps {
  schema: Record<string, unknown>
}

export function JsonLd({ schema }: JsonLdProps) {
  return (
    <Script
      id="jsonld-local-business"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
