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
import { getTableConfig } from 'drizzle-orm/pg-core'
import { bestOfVote, owner } from '../db/schema'
import { castVoteSchema, buildVoteSnapshot, CastVoteError } from './best-of-votes'

describe('BestOfVote model shape', () => {
  it('exposes the registered-voter schema fields', () => {
    // The Drizzle schema (src/db/schema.ts) mirrors the database. If any of
    // these columns is missing or renamed, this fails (or fails to compile),
    // surfacing the drift.
    expect(bestOfVote.voterId.name).toBe('voterId')
    expect(bestOfVote.nomineeId.name).toBe('nomineeId')
    expect(bestOfVote.voterNameSnapshot.name).toBe('voterNameSnapshot')
    expect(bestOfVote.voterImageSnapshot.name).toBe('voterImageSnapshot')
  })

  it('defines a unique constraint on (voterId, nomineeId)', async () => {
    // The unique constraint enforces "one vote per user per nominee" at
    // the database level. If a migration accidentally drops it, parallel
    // INSERTs would quietly create duplicate votes, so assert the schema
    // still declares a unique index over exactly (voterId, nomineeId).
    const unique = getTableConfig(bestOfVote).indexes.find(
      (i) =>
        i.config.unique &&
        i.config.columns.map((c) => (c as { name: string }).name).join(',') === 'voterId,nomineeId'
    )
    expect(unique).toBeDefined()
  })
})

describe('Owner model shape', () => {
  it('exposes lastBestOfVoteAt for tracking voter activity', () => {
    expect(owner.lastBestOfVoteAt.name).toBe('lastBestOfVoteAt')
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
