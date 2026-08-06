-- Migration: add_guest_authors
-- Created: 2026-08-06
-- Curated editorial content from named contributors. Johnny (admin) is the
-- only one who creates/updates author profiles and posts. Authors do NOT
-- log in — content is collected off-platform (call, email, Google Doc)
-- and entered by Johnny. This is intentional for v1: keeps the curation
-- thesis intact and avoids building a self-serve author portal.

-- 1. GuestAuthor
CREATE TABLE "GuestAuthor" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "title" TEXT,
  "bio" TEXT NOT NULL,
  "photoUrl" TEXT,
  "personalSiteUrl" TEXT,
  "companyName" TEXT,
  "companyUrl" TEXT,
  "linkedinUrl" TEXT,
  "twitterUrl" TEXT,
  "facebookUrl" TEXT,
  "instagramUrl" TEXT,
  "businessId" TEXT,
  "ownerId" TEXT,
  "postsThisPeriod" INTEGER NOT NULL DEFAULT 0,
  "periodStartedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "lastPostedAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuestAuthor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuestAuthor_slug_key" ON "GuestAuthor"("slug");
CREATE INDEX "GuestAuthor_slug_idx" ON "GuestAuthor"("slug");
CREATE INDEX "GuestAuthor_isActive_idx" ON "GuestAuthor"("isActive");

-- 2. GuestPost
CREATE TABLE "GuestPost" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "excerpt" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "heroImageUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "submittedAt" TIMESTAMP(3),
  "scheduledFor" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "rejectionReason" TEXT,
  "authorId" TEXT NOT NULL,
  "editorNotes" TEXT,
  "metaTitle" TEXT,
  "metaDescription" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuestPost_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GuestPost_slug_key" ON "GuestPost"("slug");
CREATE INDEX "GuestPost_status_publishedAt_idx" ON "GuestPost"("status", "publishedAt" DESC);
CREATE INDEX "GuestPost_authorId_publishedAt_idx" ON "GuestPost"("authorId", "publishedAt" DESC);

-- 3. Foreign keys
ALTER TABLE "GuestAuthor"
  ADD CONSTRAINT "GuestAuthor_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GuestAuthor"
  ADD CONSTRAINT "GuestAuthor_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "Owner"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GuestPost"
  ADD CONSTRAINT "GuestPost_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "GuestAuthor"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;