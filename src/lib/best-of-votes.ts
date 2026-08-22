/**
 * Best-Of voting helpers (registered voters).
 *
 * Anti-spam: votes require a registered, signed-in Owner with a verified
 * email. The cost-of-attack shifts from "100 throwaway emails" to "100 fake
 * accounts", which is orders of magnitude harder. See
 * `.hermes/plans/2026-08-22_best-of-registered-voters.md`.
 *
 * The vote itself is a BestOfVote row joining the Owner (voter) to the
 * BestOfNominee. Voter name + avatar are snapshotted at vote-time so
 * historical share cards keep rendering even after the user changes their
 * profile or deletes their account.
 */

import { z } from 'zod'

/**
 * Public POST body schema. Only the nomineeId comes from the client — the
 * voterId is read from the NextAuth session server-side, never trusted from
 * the request body.
 */
export const castVoteSchema = z.object({
  nomineeId: z.string().min(1, 'nomineeId is required').max(64),
})

export type CastVoteInput = z.infer<typeof castVoteSchema>

/**
 * Custom error class so route handlers can distinguish "you need to verify
 * your email" (403) from "you already voted" (409) from "nominee doesn't
 * exist" (404) without parsing error messages.
 */
export class CastVoteError extends Error {
  constructor(
    public readonly code:
      | 'NOT_VERIFIED'
      | 'NOT_AUTHENTICATED'
      | 'ALREADY_VOTED'
      | 'NOMINEE_NOT_FOUND'
      | 'CATEGORY_NOT_PUBLISHED',
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'CastVoteError'
  }
}

/**
 * Minimal Owner shape needed to build a vote snapshot. We don't import the
 * full Prisma Owner type here because that would couple this helper to the
 * generated client — keeping it structural makes it easy to unit test.
 */
export interface VoterForSnapshot {
  id: string
  name: string | null
  image: string | null
  emailVerified: Date | null
}

export interface VoteSnapshot {
  voterNameSnapshot: string
  voterImageSnapshot: string | null
}

const ANONYMOUS_DISPLAY_NAME = 'MoVal member'

/**
 * Build the snapshot fields stored on BestOfVote at vote-time.
 *
 * - Voter must have a verified email — we don't store unverified votes.
 * - Voter name falls back to a generic "MoVal member" if null so the share
 *   card never renders an empty name slot.
 * - Voter image is null if the user doesn't have one set; the share card
 *   renders initials in that case.
 */
export function buildVoteSnapshot(voter: VoterForSnapshot): VoteSnapshot {
  if (!voter.emailVerified) {
    throw new CastVoteError(
      'NOT_VERIFIED',
      'Verify your email before voting. Check your inbox for the confirmation link.',
    )
  }
  return {
    voterNameSnapshot: voter.name?.trim() || ANONYMOUS_DISPLAY_NAME,
    voterImageSnapshot: voter.image ?? null,
  }
}
