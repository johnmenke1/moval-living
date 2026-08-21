interface JsonLdProps {
  schema: Record<string, unknown>
}

// Emits a single Schema.org JSON-LD <script>. Pages that need multiple
// JSON-LD blocks (e.g. /events emitting one Event per listing, /about-moreno-valley
// emitting FAQPage) use this component many times — the id attribute was
// dropped because duplicate ids in a document are invalid HTML, and Google
// identifies JSON-LD by the type attribute, not by id.
export function JsonLd({ schema }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
