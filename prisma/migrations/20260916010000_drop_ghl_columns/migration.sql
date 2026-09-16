-- Drop all GoHighLevel mirror columns. The GHL account was cancelled
-- in 2026-09; the data in these columns is no longer synced and the
-- application code no longer references them.
--
-- Drops:
--   Business.ghlLocationId        (added 2026-08-13 fix_missing_business_columns)
--   Business.ghlCompanyId         (added 2026-08-11 add_expert_partner)
--   Business.ghlContactId         (added 2026-08-11 add_expert_partner)
--   BestOfNomination.ghlContactId (added 2026-08-15 add_best_of_nomination)
--   BestOfNomination.ghlSyncedAt  (added 2026-08-15 add_best_of_nomination)
--   ExpertPartnerLead.ghlContactId (added 2026-08-11 add_expert_partner)
--   ExpertPartnerLead.ghlSyncedAt  (added 2026-08-11 add_expert_partner)
--
-- In Postgres, Prisma's `@unique` columns create unique CONSTRAINTS
-- (which internally own indexes named "<table>_<col>_key"). Dropping
-- the index directly fails because the constraint depends on it. The
-- correct order is:
--   1. ALTER TABLE ... DROP CONSTRAINT  (kills the index automatically)
--   2. ALTER TABLE ... DROP COLUMN
--
-- The first attempted version of this migration tried DROP INDEX
-- directly and hit P3018 / 2BP01 ("cannot drop index ... because
-- constraint ... requires it"). This version is the fix.

-- Step 1: drop unique constraints (which own the indexes).
ALTER TABLE "Business"             DROP CONSTRAINT IF EXISTS "Business_ghlCompanyId_key";
ALTER TABLE "Business"             DROP CONSTRAINT IF EXISTS "Business_ghlContactId_key";
ALTER TABLE "BestOfNomination"     DROP CONSTRAINT IF EXISTS "BestOfNomination_ghlContactId_key";

-- Step 2: drop the columns. ALTER TABLE ... DROP COLUMN removes any
-- remaining indexes (the auto-btree on non-unique columns) automatically.
ALTER TABLE "Business"          DROP COLUMN IF EXISTS "ghlLocationId";
ALTER TABLE "Business"          DROP COLUMN IF EXISTS "ghlCompanyId";
ALTER TABLE "Business"          DROP COLUMN IF EXISTS "ghlContactId";
ALTER TABLE "BestOfNomination"  DROP COLUMN IF EXISTS "ghlContactId";
ALTER TABLE "BestOfNomination"  DROP COLUMN IF EXISTS "ghlSyncedAt";
ALTER TABLE "ExpertPartnerLead" DROP COLUMN IF EXISTS "ghlContactId";
ALTER TABLE "ExpertPartnerLead" DROP COLUMN IF EXISTS "ghlSyncedAt";
