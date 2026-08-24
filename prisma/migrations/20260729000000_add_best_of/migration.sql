-- Migration: add_best_of
-- Created: 2026-07-29
-- Best Of pages: BestOfCategory, BestOfEntry, BestOfScore models
--
-- NOTE: BestOfEntry was renamed to BestOfNominee shortly after this
-- migration shipped (see BestOfNominee model added later). The
-- references to BestOfEntry / BestOfScore in this file are the
-- ORIGINAL names from when the migration ran. In the live DB today,
-- the table is `BestOfNominee`. DO NOT try to "fix" the SQL —
-- applying this file as-written would fail because BestOfEntry
-- no longer exists. This file stays here purely for history +
-- checksum stability. See prisma/migrations/20260815000000_add_
-- best_of_nomination for the rename that took effect in the DB.
--
-- 1. BestOfCategory
CREATE TABLE "BestOfCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "icon" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BestOfCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BestOfCategory_slug_key" ON "BestOfCategory"("slug");
CREATE UNIQUE INDEX "BestOfCategory_name_key" ON "BestOfCategory"("name");
CREATE INDEX "BestOfCategory_slug_idx" ON "BestOfCategory"("slug");

-- 2. BestOfEntry
CREATE TABLE "BestOfEntry" (
  "id" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "rank" INTEGER,
  "compositeScore" DOUBLE PRECISION,
  "localOwnership" INTEGER NOT NULL DEFAULT 0,
  "uniqueness" INTEGER NOT NULL DEFAULT 0,
  "communityInvolvement" INTEGER NOT NULL DEFAULT 0,
  "personalVisitReview" INTEGER NOT NULL DEFAULT 0,
  "googleRating" DOUBLE PRECISION,
  "googleReviewCount" INTEGER,
  "yearsActive" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BestOfEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BestOfEntry_categoryId_businessId_key" UNIQUE,
  CONSTRAINT "BestOfEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BestOfCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BestOfEntry_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "BestOfEntry_categoryId_idx" ON "BestOfEntry"("categoryId");
CREATE INDEX "BestOfEntry_compositeScore_idx" ON "BestOfEntry"("compositeScore");

-- 3. BestOfScore
CREATE TABLE "BestOfScore" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "factor" TEXT NOT NULL,
  "rawValue" DOUBLE PRECISION NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "BestOfScore_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BestOfScore_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "BestOfEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "BestOfScore_entryId_idx" ON "BestOfScore"("entryId");
