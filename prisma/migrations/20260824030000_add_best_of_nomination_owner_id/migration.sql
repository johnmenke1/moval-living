-- Tie nominations to Owner accounts.
--
-- Adds BestOfNomination.ownerId (nullable FK) so:
--   1. New nominations from logged-in users can be linked to their
--      Owner row at insert time (the nominations POST handler reads
--      `auth()` and writes ownerId when a session is present).
--   2. Existing anonymous nominations can be backfilled by matching
--      nominatorEmail -> Owner.email (done in a separate script so
--      it can be re-run idempotently without re-running this
--      migration).
--
-- onDelete: SetNull — if an Owner account is deleted, their
-- nominations stay in the moderation queue but lose the owner
-- linkage. The admin moderation flow still needs to see them
-- regardless of whether the original nominator's account still
-- exists.

ALTER TABLE "BestOfNomination"
  ADD COLUMN "ownerId" TEXT;

ALTER TABLE "BestOfNomination"
  ADD CONSTRAINT "BestOfNomination_ownerId_fk"
  FOREIGN KEY ("ownerId") REFERENCES "Owner"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BestOfNomination_ownerId_idx" ON "BestOfNomination"("ownerId");