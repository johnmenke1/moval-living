-- Create enum type first
CREATE TYPE "EventAttendeeStatus" AS ENUM ('GOING', 'INTERESTED');

-- Create the EventAttendee table
CREATE TABLE "EventAttendee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "EventAttendeeStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventAttendee_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one RSVP per user per event
CREATE UNIQUE INDEX "EventAttendee_eventId_ownerId_key" ON "EventAttendee"("eventId", "ownerId");

-- Indexes for lookups by event, owner, and status
CREATE INDEX "EventAttendee_eventId_idx" ON "EventAttendee"("eventId");
CREATE INDEX "EventAttendee_ownerId_idx" ON "EventAttendee"("ownerId");
CREATE INDEX "EventAttendee_status_idx" ON "EventAttendee"("status");

-- Foreign keys with CASCADE deletes
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_eventId_fkey"
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
