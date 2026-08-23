/**
 * /best-of/voted/[voteId] helpers — fetch a vote by id and resolve the
 * share URL. Kept pure (no DB calls inside helpers) so the unit tests
 * can verify the URL-shaping logic without a real Prisma client.
 */

import { describe, expect, it } from 'vitest'
import { buildShareMessage, buildCanonicalShareUrl } from './voted-helpers'

describe('buildShareMessage', () => {
  it('formats the share text with voter + nominee + brand', () => {
    const msg = buildShareMessage({
      voterName: 'Sarah K.',
      nomineeName: 'Goat & Vine Coffee',
      categoryName: 'Best Coffee',
    })
    expect(msg).toBe(
      'Sarah K. voted for Goat & Vine Coffee in the Best Of MoVal — Best Coffee category. Cast your vote:'
    )
  })

  it('handles short or anonymous-derivation voter names', () => {
    const msg = buildShareMessage({
      voterName: 'MoVal member',
      nomineeName: 'Tacos El Chavito',
      categoryName: 'Best Burrito',
    })
    expect(msg).toContain('MoVal member voted for Tacos El Chavito')
  })
})

describe('buildCanonicalShareUrl', () => {
  it('builds an absolute URL from a vote id', () => {
    const url = buildCanonicalShareUrl('vote_abc123', 'https://www.moval.living')
    expect(url).toBe('https://www.moval.living/best-of/voted/vote_abc123')
  })

  it('strips trailing slashes from the base URL', () => {
    const url = buildCanonicalShareUrl('vote_xyz', 'https://www.moval.living/')
    expect(url).toBe('https://www.moval.living/best-of/voted/vote_xyz')
  })
})
