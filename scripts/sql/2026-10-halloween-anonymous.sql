-- Address-only mandatory Halloween entries: every non-address field becomes optional.
-- Idempotent: DROP NOT NULL is a no-op if the column is already nullable.
-- Run once on the production Postgres alongside the HalloweenEntry table.

BEGIN;

ALTER TABLE "HalloweenEntry" ALTER COLUMN "contactName"  DROP NOT NULL;
ALTER TABLE "HalloweenEntry" ALTER COLUMN "contactEmail" DROP NOT NULL;
ALTER TABLE "HalloweenEntry" ALTER COLUMN "displayName"  DROP NOT NULL;
ALTER TABLE "HalloweenEntry" ALTER COLUMN "description"  DROP NOT NULL;

COMMIT;
