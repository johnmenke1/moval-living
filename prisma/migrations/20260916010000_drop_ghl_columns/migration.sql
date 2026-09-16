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
-- Index drops: ghlContactId has @unique on Business and BestOfNomination;
-- the unique indexes go with their columns.

-- Drop indexes first (Postgres allows DROP COLUMN with index, but being
-- explicit is safer and matches the standard Postgres migration pattern).
DROP INDEX IF EXISTS "Business_ghlCompanyId_key";
DROP INDEX IF EXISTS "Business_ghlContactId_key";
DROP INDEX IF EXISTS "BestOfNomination_ghlContactId_key";

-- Business table — 3 columns
ALTER TABLE "Business" DROP COLUMN IF EXISTS "ghlLocationId";
ALTER TABLE "Business" DROP COLUMN IF EXISTS "ghlCompanyId";
ALTER TABLE "Business" DROP COLUMN IF EXISTS "ghlContactId";

-- BestOfNomination — 2 columns
ALTER TABLE "BestOfNomination" DROP COLUMN IF EXISTS "ghlContactId";
ALTER TABLE "BestOfNomination" DROP COLUMN IF EXISTS "ghlSyncedAt";

-- ExpertPartnerLead — 2 columns
ALTER TABLE "ExpertPartnerLead" DROP COLUMN IF EXISTS "ghlContactId";
ALTER TABLE "ExpertPartnerLead" DROP COLUMN IF EXISTS "ghlSyncedAt";
