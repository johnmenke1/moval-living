-- Add submitter consent fields to Business (for CAN-SPAM / 10DLC audit trail)
-- These record consent given at the time of submission, BEFORE the
-- business is claimed. When the owner claims the listing, they re-confirm
-- by going through the claim flow which updates Owner.emailOptIn (the
-- canonical consent record).
ALTER TABLE "Business" ADD COLUMN "submitterEmailOptIn" BOOLEAN     NOT NULL DEFAULT false;
ALTER TABLE "Business" ADD COLUMN "submitterSmsOptIn"   BOOLEAN     NOT NULL DEFAULT false;
ALTER TABLE "Business" ADD COLUMN "submitterConsentAt"  TIMESTAMP(3);
