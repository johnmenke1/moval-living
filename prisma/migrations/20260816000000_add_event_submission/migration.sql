-- Migration: add_event_submission
-- New Event + Submission tables replace the Instagram-as-event workflow on
-- /events. Submission is what humans (and Emma's regional scan) write;
-- Event is what the public /events page renders after admin approval.
--
-- Venue tags are an explicit allowlist of curated regional venues. Anything
-- not in the list is OTHER, which still surfaces on /events for Moreno
-- Valley submissions but is filtered out for the broader regional view.

-- CreateEnum
CREATE TYPE "VenueTag" AS ENUM (
  'FOX_RIVERSIDE',
  'RIVERSIDE_MUNICIPAL_AUDITORIUM',
  'RIVERSIDE_CONVENTION_CENTER',
  'UCR',
  'CBU',
  'RIVERSIDE_ART_MUSEUM',
  'RIVERSIDE_METROPOLITAN_MUSEUM',
  'REDLANDS_BOWL',
  'REDLANDS_THEATER_FESTIVAL',
  'MOVAL_HIGH_SCHOOL',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "EventTier" AS ENUM (
  'STANDARD',
  'HONORABLE_MENTION',
  'HERO'
);

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'DUPLICATE'
);

-- CreateEnum
CREATE TYPE "SubmissionSource" AS ENUM (
  'INSTAGRAM',
  'FACEBOOK',
  'OTHER'
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourcePlatform" "SubmissionSource" NOT NULL,
    "sourceAuthorHandle" TEXT,
    "sourceAuthorUrl" TEXT,
    "sourceThumbnailUrl" TEXT,
    "sourceCapturedAt" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "venueName" TEXT,
    "submittedById" TEXT,
    "submitterNote" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "promotedToEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "venueName" TEXT,
    "venueTag" "VenueTag" NOT NULL DEFAULT 'OTHER',
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "category" TEXT,
    "heroImageUrl" TEXT,
    "ticketUrl" TEXT,
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "tier" "EventTier" NOT NULL DEFAULT 'STANDARD',
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceAuthorHandle" TEXT,
    "sourceAuthorUrl" TEXT,
    "sourcePostExcerpt" TEXT,
    "originatingSubmissionId" TEXT,
    "submittedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Submission_slug_key" ON "Submission"("slug");

-- CreateIndex
CREATE INDEX "Submission_status_idx" ON "Submission"("status");

-- CreateIndex
CREATE INDEX "Submission_startsAt_idx" ON "Submission"("startsAt");

-- CreateIndex
CREATE INDEX "Submission_createdAt_idx" ON "Submission"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_startsAt_idx" ON "Event"("startsAt");

-- CreateIndex
CREATE INDEX "Event_tier_idx" ON "Event"("tier");

-- CreateIndex
CREATE INDEX "Event_venueTag_idx" ON "Event"("venueTag");

-- CreateIndex
CREATE INDEX "Event_city_idx" ON "Event"("city");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_originatingSubmissionId_fkey" FOREIGN KEY ("promotedToEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
