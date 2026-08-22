-- Migration: add_best_of_vote_registered_voters
-- Created: 2026-08-22
--
-- Best-Of voting now requires a registered, signed-in Owner (NOT anonymous
-- magic-link). One BestOfVote row per (voter, nominee), with voter name +
-- image snapshotted at vote-time so historical share cards keep rendering.
--
-- Anti-abuse: voting requires a registered Owner with a verified email.
-- The cost-of-attack shifts from "100 throwaway emails" to "100 fake
-- accounts", which is orders of magnitude harder.
--
-- See .hermes/plans/2026-08-22_best-of-registered-voters.md for the
-- full threat model and the magic-link approach this replaced.

-- 1. BestOfVote table
CREATE TABLE "BestOfVote" (
    "id" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "nomineeId" TEXT NOT NULL,
    "voterNameSnapshot" TEXT NOT NULL,
    "voterImageSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BestOfVote_pkey" PRIMARY KEY ("id")
);

-- 2. Unique constraint: one vote per (voter, nominee)
CREATE UNIQUE INDEX "BestOfVote_voterId_nomineeId_key" ON "BestOfVote"("voterId", "nomineeId");

-- 3. Indexes for common query patterns
CREATE INDEX "BestOfVote_nomineeId_createdAt_idx" ON "BestOfVote"("nomineeId", "createdAt" DESC);
CREATE INDEX "BestOfVote_voterId_createdAt_idx" ON "BestOfVote"("voterId", "createdAt" DESC);

-- 4. Foreign keys (cascade on delete so voter + nominee deletion cleans up votes)
ALTER TABLE "BestOfVote" ADD CONSTRAINT "BestOfVote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BestOfVote" ADD CONSTRAINT "BestOfVote_nomineeId_fkey" FOREIGN KEY ("nomineeId") REFERENCES "BestOfNominee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Owner.lastBestOfVoteAt — used by future v1.5 digests
ALTER TABLE "Owner" ADD COLUMN "lastBestOfVoteAt" TIMESTAMP(3);
