-- Tie reviews to Owner accounts.
--
-- Adds Review.ownerId (nullable FK) so:
--   1. New reviews from logged-in users can be linked to their Owner
--      row at insert time.
--   2. Existing anonymous reviews can be backfilled by matching
--      authorEmail -> Owner.email (done in a separate script so it
--      can be re-run idempotently without re-running this migration).
--
-- onDelete: SetNull — if an Owner account is deleted, their reviews
-- stay on the business page but lose the owner linkage. This is the
-- safer default than Cascade (which would silently drop history).

ALTER TABLE "Review"
  ADD COLUMN "ownerId" TEXT;

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_ownerId_fk"
  FOREIGN KEY ("ownerId") REFERENCES "Owner"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Review_ownerId_idx" ON "Review"("ownerId");
