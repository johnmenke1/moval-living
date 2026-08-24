-- Track whether a BestOfNomination came from a logged-in Owner.
--
-- Default false. When the nomination POST handler sees an active
-- session (ownerId set), it sets this to true. The success page
-- reads it to decide whether to show "Set a password to also vote".
-- A GHL tag (nominee-no-account) is fired in the opposite case so a
-- follow-up workflow can nudge them.
--
-- onDelete behavior for the Owner relationship is unchanged (SetNull);
-- accountCreated only records the submit-time state, not the live
-- state. If an Owner account is later deleted, accountCreated stays
-- at whatever it was — that's still accurate as a historical record.

ALTER TABLE "BestOfNomination"
  ADD COLUMN "accountCreated" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: any nomination with a non-null ownerId was logged in at
-- submit time, so accountCreated is true for those rows. The DEFAULT
-- false handled the NULL case (legacy anonymous submissions).
UPDATE "BestOfNomination"
SET "accountCreated" = true
WHERE "ownerId" IS NOT NULL;

CREATE INDEX "BestOfNomination_accountCreated_idx"
  ON "BestOfNomination"("accountCreated");