-- Allow anonymous Halloween entries: contactName/contactEmail become optional.
-- Idempotent: leaves the column NOT NULL only as DROP NOT NULL (no-op if already nullable).
-- Run once on the production Postgres alongside the HalloweenEntry table.

BEGIN;

ALTER TABLE "HalloweenEntry" ALTER COLUMN "contactName"  DROP NOT NULL;
ALTER TABLE "HalloweenEntry" ALTER COLUMN "contactEmail" DROP NOT NULL;

COMMIT;
