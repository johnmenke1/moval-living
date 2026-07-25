import { describe, expect, it } from 'vitest'
import { getAutoApprovedClaimData, isClaimValid } from './claim-policy'

describe('claim policy', () => {
  it('auto-publishes a listing after a valid verified claim', () => {
    expect(getAutoApprovedClaimData('owner-1')).toEqual({
      owner: { connect: { id: 'owner-1' } },
      claimToken: null,
      claimExpiresAt: null,
      status: 'APPROVED',
    })
  })

  it('requires an unclaimed listing with an unexpired token', () => {
    const future = new Date('2030-01-02T00:00:00.000Z')
    const now = new Date('2030-01-01T00:00:00.000Z')
    expect(isClaimValid({ ownerId: null, claimExpiresAt: future }, now)).toBe(true)
    expect(isClaimValid({ ownerId: 'owner-1', claimExpiresAt: future }, now)).toBe(false)
    expect(isClaimValid({ ownerId: null, claimExpiresAt: now }, now)).toBe(false)
  })
})
