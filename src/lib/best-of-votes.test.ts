/**
 * Best-Of Vote helpers (registered voters).
 *
 * Anti-spam: votes require a registered, signed-in Owner with a verified
 * email. The cost-of-attack shifts from "100 throwaway emails" to "100 fake
 * accounts", which is orders of magnitude harder.
 *
 * The vote itself is a join row: one BestOfVote per (voter, nominee). The
 * voter's display name + avatar are snapshotted at vote-time so historical
 * share cards keep rendering even after the user changes their profile.
 */

import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { castVoteSchema, buildVoteSnapshot, CastVoteError } from './best-of-votes'

describe('BestOfVote model shape', () => {
  it('exposes the registered-voter schema fields', () => {
    // The Prisma client is generated from schema.prisma. If any of these
    // fields is missing or renamed, the schema migration hasn't shipped
    // yet — this test fails to compile, surfacing the drift.
    expect(typeof Prisma.BestOfVoteScalarFieldEnum).toBe('object')
    expect(Prisma.BestOfVoteScalarFieldEnum.voterId).toBe('voterId')
    expect(Prisma.BestOfVoteScalarFieldEnum.nomineeId).toBe('nomineeId')
    expect(Prisma.BestOfVoteScalarFieldEnum.voterNameSnapshot).toBe(
      'voterNameSnapshot'
    )
    expect(Prisma.BestOfVoteScalarFieldEnum.voterImageSnapshot).toBe(
      'voterImageSnapshot'
    )
  })

  it('defines a unique constraint on (voterId, nomineeId)', async () => {
    // The unique constraint enforces "one vote per user per nominee" at
    // the database level. If a migration accidentally drops it, this
    // query succeeds when it shouldn't — but a parallel INSERT would
    // quietly create duplicate votes. The cleanest assertion is that
    // the model exposes BestOfVoteWhereUniqueInput with voterId_nomineeId.
    const uniqueInput: Prisma.BestOfVoteWhereUniqueInput = {
      voterId_nomineeId: {
        voterId: 'placeholder',
        nomineeId: 'placeholder',
      },
    }
    expect(uniqueInput.voterId_nomineeId).toBeDefined()
  })
})

describe('Owner model shape', () => {
  it('exposes lastBestOfVoteAt for tracking voter activity', () => {
    expect(Prisma.OwnerScalarFieldEnum.lastBestOfVoteAt).toBe('lastBestOfVoteAt')
  })
})

describe('castVoteSchema', () => {
  // Minimal zod payload shape — the route handler builds the rest (voterId
  // from session, snapshot fields from Owner lookup).
  it('rejects empty body', () => {
    expect(() => castVoteSchema.parse({})).toThrow()
  })

  it('rejects missing nomineeId', () => {
    expect(() => castVoteSchema.parse({ nomineeId: '' })).toThrow()
  })

  it('accepts a valid nomineeId', () => {
    const parsed = castVoteSchema.parse({ nomineeId: 'cuid_abc123' })
    expect(parsed.nomineeId).toBe('cuid_abc123')
  })
})

describe('buildVoteSnapshot', () => {
  it('captures voter display name + image at vote time', () => {
    const snapshot = buildVoteSnapshot({
      id: 'owner_123',
      name: 'Sarah K.',
      image: 'https://example.com/avatars/sarah.jpg',
      emailVerified: new Date(),
    })
    expect(snapshot.voterNameSnapshot).toBe('Sarah K.')
    expect(snapshot.voterImageSnapshot).toBe('https://example.com/avatars/sarah.jpg')
  })

  it('falls back to a derived name when name is null', () => {
    const snapshot = buildVoteSnapshot({
      id: 'owner_456',
      name: null,
      image: null,
      emailVerified: new Date(),
    })
    expect(snapshot.voterNameSnapshot).toBe('MoVal member')
    expect(snapshot.voterImageSnapshot).toBeNull()
  })

  it('throws CastVoteError if the voter is not email-verified', () => {
    expect(() =>
      buildVoteSnapshot({
        id: 'owner_789',
        name: 'Pat Q.',
        image: null,
        emailVerified: null,
      })
    ).toThrow(CastVoteError)
  })
})
