-- Migration: add_expert_partner
-- Created: 2026-08-11
-- Moreno Valley Expert Partner program — $197/mo or $997/yr, one business per
-- category. Adds EXPERT_PARTNER tier value, Expert Partner flags on Business,
-- ExpertPartnerLead (form submissions), and ExpertPartnerStat (monthly recaps).
--
-- IMPORTANT: Postgres requires ALTER TYPE ... ADD VALUE in its own
-- transaction — it CANNOT be in the same transaction as other DDL. Run
-- this file via psql / pg driver in two batches:
--   1. ALTER TYPE "Tier" ADD VALUE 'EXPERT_PARTNER'
--   2. ALTER TABLE / CREATE TABLE statements below

-- ── Step 1: Add EXPERT_PARTNER to Tier enum (must be its own txn) ─────────
-- ALTER TYPE "Tier" ADD VALUE IF NOT EXISTS 'EXPERT_PARTNER';

-- ── Step 2: Business columns ───────────────────────────────────────────────
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "isExpertPartner"      BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "expertPartnerSlug"    TEXT,
  ADD COLUMN IF NOT EXISTS "foundingPartnerSince" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "liveQaZoomUrl"        TEXT,
  ADD COLUMN IF NOT EXISTS "liveQaNextDate"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ghlCompanyId"         TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Business_ghlCompanyId_key"
  ON "Business" ("ghlCompanyId");

-- Unique index on expertPartnerSlug (nullable → NULLs don't conflict)
CREATE UNIQUE INDEX IF NOT EXISTS "Business_expertPartnerSlug_key"
  ON "Business" ("expertPartnerSlug");

-- Partial index for fast Expert Partner listing queries
CREATE INDEX IF NOT EXISTS "Business_isExpertPartner_idx"
  ON "Business" ("isExpertPartner");

-- ── Step 3: New tables ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ExpertPartnerLead" (
  "id"           TEXT         NOT NULL,
  "businessId"   TEXT         NOT NULL,
  "name"         TEXT         NOT NULL,
  "email"        TEXT         NOT NULL,
  "phone"        TEXT,
  "message"      TEXT         NOT NULL,
  "sourceIp"     TEXT,
  "userAgent"    TEXT,
  "contacted"    BOOLEAN      NOT NULL DEFAULT false,
  "contactedAt"  TIMESTAMP(3),
  "notes"        TEXT,
  "ghlContactId" TEXT,
  "ghlSyncedAt"  TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExpertPartnerLead_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExpertPartnerLead_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ExpertPartnerLead_businessId_createdAt_idx"
  ON "ExpertPartnerLead" ("businessId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ExpertPartnerLead_contacted_idx"
  ON "ExpertPartnerLead" ("contacted");

CREATE TABLE IF NOT EXISTS "ExpertPartnerStat" (
  "id"              TEXT         NOT NULL,
  "businessId"      TEXT         NOT NULL,
  "month"           TIMESTAMP(3) NOT NULL,
  "storyViews"      INTEGER      NOT NULL DEFAULT 0,
  "newsletterOpens" INTEGER      NOT NULL DEFAULT 0,
  "listingClicks"   INTEGER      NOT NULL DEFAULT 0,
  "notes"           TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExpertPartnerStat_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExpertPartnerStat_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ExpertPartnerStat_businessId_month_key"
  ON "ExpertPartnerStat" ("businessId", "month");
CREATE INDEX IF NOT EXISTS "ExpertPartnerStat_businessId_month_idx"
  ON "ExpertPartnerStat" ("businessId", "month" DESC);