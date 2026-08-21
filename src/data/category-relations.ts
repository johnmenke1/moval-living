/**
 * Hand-curated "related categories" graph for /category/[slug] pages.
 *
 * Each category lists 4 related slugs. Editorial, not auto-derived —
 * auto-derivation from category description keyword overlap gets the
 * relations wrong (e.g. "dispensaries" should NOT be linked from
 * "churches" even though both are community-institution-ish).
 *
 * Design rules for the graph:
 *  - Symmetric where possible (if A lists B, B should list A).
 *  - Cross-vertical relations are encouraged (restaurants ↔
 *    hospitality, contractors ↔ home-services) — that's where the
 *    real internal-link juice lives.
 *  - No category is ever related to itself.
 *  - The 4 are ordered most-related first.
 */

export const categoryRelations: Record<string, string[]> = {
  // 1
  restaurants: ['hospitality', 'entertainment', 'professional', 'retail'],

  // 2
  contractors: ['home-services', 'real-estate', 'professional', 'property-management'],

  // 3
  healthcare: ['beauty', 'professional', 'insurance', 'finance'],

  // 4
  retail: ['restaurants', 'beauty', 'professional', 'entertainment'],

  // 5
  'auto-repair': ['auto-dealers', 'contractors', 'professional', 'insurance'],

  // 6
  'auto-dealers': ['auto-repair', 'professional', 'finance', 'insurance'],

  // 7
  churches: ['non-profits', 'service-clubs', 'education', 'professional'],

  // 8
  'property-management': ['real-estate', 'contractors', 'home-services', 'professional'],

  // 9
  'non-profits': ['churches', 'service-clubs', 'education', 'healthcare'],

  // 10
  'supply-logistics': ['professional', 'retail', 'contractors', 'auto-dealers'],

  // 11
  entertainment: ['restaurants', 'hospitality', 'retail', 'beauty'],

  // 12
  professional: ['real-estate', 'finance', 'insurance', 'contractors'],

  // 13
  insurance: ['professional', 'finance', 'auto-repair', 'healthcare'],

  // 14
  dispensaries: ['healthcare', 'retail', 'professional', 'beauty'],

  // 15
  hospitality: ['restaurants', 'entertainment', 'professional', 'beauty'],

  // 16
  'service-clubs': ['non-profits', 'churches', 'education', 'professional'],

  // 17
  beauty: ['healthcare', 'retail', 'professional', 'restaurants'],

  // 18
  'home-services': ['contractors', 'real-estate', 'property-management', 'retail'],

  // 19
  education: ['professional', 'service-clubs', 'non-profits', 'churches'],

  // 20
  pets: ['retail', 'home-services', 'beauty', 'healthcare'],

  // 21
  finance: ['real-estate', 'insurance', 'professional', 'auto-dealers'],

  // 22
  'real-estate': ['finance', 'property-management', 'contractors', 'professional'],
}

/** Lookup helper. */
export function getRelatedCategories(slug: string): string[] {
  return categoryRelations[slug] ?? []
}
