// Display helpers that keep internal / imported data from leaking into the UI.
//
// A large share of listings were seeded from OSM or the chamber directory and
// carry machine-generated placeholder text ("OSM import: …", "Business
// information for …"). Residents should never see that — these helpers decide
// what is safe to render and provide warm fallbacks when the real content is
// missing.

const PLACEHOLDER_DESCRIPTION_PATTERNS: RegExp[] = [
  /^OSM import:/i,
  /^Business information for /i,
  /listing details are pending owner verification/i,
  /^Imported from /i,
]

/** True when a stored description is machine-generated filler, not real copy. */
export function isPlaceholderDescription(description: string | null | undefined): boolean {
  if (!description) return true
  const trimmed = description.trim()
  if (trimmed.length === 0) return true
  return PLACEHOLDER_DESCRIPTION_PATTERNS.some(re => re.test(trimmed))
}

/**
 * Description safe to show on cards and detail pages. Returns the real
 * description when one exists, otherwise a short neutral line built from the
 * category — never the raw import text.
 */
export function publicDescription(
  business: { description: string | null; category?: { name: string } | null },
): string {
  if (!isPlaceholderDescription(business.description)) {
    return (business.description as string).trim()
  }
  const categoryName = business.category?.name
  return categoryName
    ? `A ${categoryName.replace(/ & /g, ' and ').toLowerCase()} spot in Moreno Valley.`
    : 'A local business in Moreno Valley.'
}

/** Address line with import artifacts (e.g. "(no street on file)") removed. */
export function publicAddress(address: string | null | undefined): string {
  if (!address) return 'Moreno Valley'
  const cleaned = address.replace(/\(no street on file\),?\s*/gi, '').trim().replace(/^,\s*/, '')
  return cleaned.length > 0 ? cleaned : 'Moreno Valley'
}
