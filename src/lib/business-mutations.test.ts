import { describe, expect, it } from 'vitest'
import {
  buildBusinessUpdateData,
  canManageBusiness,
} from './business-mutations'

describe('canManageBusiness', () => {
  it('allows the claimed owner to edit their listing', () => {
    expect(canManageBusiness({ userId: 'owner-1', role: 'USER' }, 'owner-1')).toBe(true)
  })

  it('allows an administrator to edit any listing', () => {
    expect(canManageBusiness({ userId: 'admin-1', role: 'ADMIN' }, 'owner-1')).toBe(true)
  })

  it('rejects unrelated and anonymous users', () => {
    expect(canManageBusiness({ userId: 'owner-2', role: 'USER' }, 'owner-1')).toBe(false)
    expect(canManageBusiness(null, 'owner-1')).toBe(false)
  })
})

describe('buildBusinessUpdateData', () => {
  it('keeps editable listing fields and normalizes optional values', () => {
    expect(buildBusinessUpdateData({
      name: ' Menke Real Estate ',
      tagline: '',
      description: 'A detailed description of the business and its services.',
      categoryId: 'category-1',
      address: '123 Main St',
      city: 'Moreno Valley',
      state: 'CA',
      zip: '92553',
      phone: '',
      website: 'https://example.com',
      email: 'office@example.com',
      facebook: '',
      instagram: null,
      yelp: undefined,
      hours: { mon: { open: '9:00 AM', close: '5:00 PM', closed: false } },
      // Deal fields were removed from the Business update payload. They
      // now live on the first-class Deal model and are managed via
      // /api/deals — see migration 20260915000000_drop_business_coupon.
    })).toEqual({
      name: 'Menke Real Estate',
      tagline: null,
      description: 'A detailed description of the business and its services.',
      category: { connect: { id: 'category-1' } },
      address: '123 Main St',
      city: 'Moreno Valley',
      state: 'CA',
      zip: '92553',
      phone: null,
      website: 'https://example.com',
      email: 'office@example.com',
      facebook: null,
      instagram: null,
      yelp: null,
      hours: { mon: { open: '9:00 AM', close: '5:00 PM', closed: false } },
      // Optional Business fields that pass through as undefined when not
      // provided in the input — surfaced explicitly so the test shape
      // matches the actual return value from buildBusinessUpdateData.
      googleRating: null,
      googleReviewCount: null,
      googleBusiness: null,
      isExpertPartner: undefined,
      expertPartnerSlug: null,
      foundingPartnerSince: undefined,
      liveQaZoomUrl: null,
      liveQaNextDate: undefined,
      seHablaEspanol: undefined,
      chamberMember: undefined,
      hispanicChamberMember: undefined,
    })
  })

  it('rejects deal payload fields since deals now live on their own model', () => {
    // Sending the old hasCoupon/coupon shape now throws because the
    // Business update schema is strict and these keys are no longer
    // accepted — deals are managed via /api/deals.
    expect(() => buildBusinessUpdateData({
      name: 'Safe Business',
      description: 'A sufficiently detailed description for a real business listing.',
      categoryId: 'category-1',
      address: '123 Main St',
      city: 'Moreno Valley',
      state: 'CA',
      zip: '92553',
      hasCoupon: true,
      coupon: { headline: 'Some deal' },
    })).toThrow()
  })

  it('rejects protected or unknown fields instead of passing them to Prisma', () => {
    expect(() => buildBusinessUpdateData({
      name: 'Safe Business',
      description: 'A sufficiently detailed description for a real business listing.',
      categoryId: 'category-1',
      address: '123 Main St',
      city: 'Moreno Valley',
      state: 'CA',
      zip: '92553',
      status: 'REJECTED',
      tier: 'FEATURED',
      ownerId: 'attacker',
      claimToken: 'stolen',
      slug: 'hijacked',
      id: 'different-id',
    })).toThrow()
  })

  it('rejects malformed or incomplete listing updates', () => {
    expect(() => buildBusinessUpdateData({ name: '', description: 'short' })).toThrow()
  })
})
