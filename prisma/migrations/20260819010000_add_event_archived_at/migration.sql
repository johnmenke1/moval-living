-- Add Event.archivedAt for soft-delete. When non-null, the event is hidden
-- from public /events listings and from the default Live Events admin view.
-- Admin can un-archive by setting archivedAt back to null. A daily cron sets
-- archivedAt for events 30+ days past their end (or start, if no end given).
ALTER TABLE "Event" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Event_archivedAt_idx" ON "Event"("archivedAt");