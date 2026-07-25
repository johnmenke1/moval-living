import { Prisma } from '@prisma/client'
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
      hasCoupon: false,
      coupon: { headline: 'This must be cleared' },
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
      hasCoupon: false,
      coupon: Prisma.JsonNull,
    })
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
