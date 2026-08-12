-- Migration: add_best_of_nomination
-- Public Best-Of nominations table — visitors submit business suggestions
-- via /submit/best-of. Lands PENDING, reviewed by admin in the dashboard
-- "Best-Of Nominations" tab. See BestOfNomination model in schema.prisma
-- for field semantics.

-- CreateEnum
CREATE TYPE "BestOfNominationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "BestOfNomination" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "businessId" TEXT,
    "categoryName" TEXT NOT NULL,
    "nominatorName" TEXT NOT NULL,
    "nominatorEmail" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "BestOfNominationStatus" NOT NULL DEFAULT 'PENDING',
    "emailOptIn" BOOLEAN NOT NULL DEFAULT false,
    "smsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "emailConsentAt" TIMESTAMP(3),
    "consentSource" TEXT,
    "ghlContactId" TEXT,
    "ghlSyncedAt" TIMESTAMP(3),
    "sourceIp" TEXT,
    "userAgent" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "adminNotes" TEXT,
    "promotedNomineeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BestOfNomination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BestOfNomination_ghlContactId_key" ON "BestOfNomination"("ghlContactId");

-- CreateIndex
CREATE UNIQUE INDEX "BestOfNomination_promotedNomineeId_key" ON "BestOfNomination"("promotedNomineeId");

-- CreateIndex
CREATE INDEX "BestOfNomination_status_createdAt_idx" ON "BestOfNomination"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BestOfNomination_nominatorEmail_idx" ON "BestOfNomination"("nominatorEmail");

-- CreateIndex
CREATE INDEX "BestOfNomination_businessId_idx" ON "BestOfNomination"("businessId");

-- AddForeignKey
ALTER TABLE "BestOfNomination" ADD CONSTRAINT "BestOfNomination_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;