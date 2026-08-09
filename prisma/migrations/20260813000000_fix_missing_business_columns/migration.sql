-- Migration: fix_missing_business_columns
-- Backfills columns declared in the schema but never added by the
-- 20260808000000_add_business_audit migration (which only created BusinessAudit).
--
-- Columns being added:
--   foundingPartnerRate  Boolean  — locks legacy $997/yr price; live DB has 506 rows
--   ghlLocationId        Text     — GHL location mapping (private integration token)

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "foundingPartnerRate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ghlLocationId" TEXT;
