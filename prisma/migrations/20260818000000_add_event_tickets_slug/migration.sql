-- Add ticketsSlug column to Event for the /tickets/[slug] shareable route.
-- Optional column — events without a ticket slug continue to use the
-- original /events/<slug> link or /business/<slug> if linked to a Business.
--
-- Admin-set in /dashboard/events/edit. Uniqueness across all events is
-- enforced at the DB level; the PATCH endpoint also performs a findFirst
-- uniqueness check before write so collisions return a clean 400 instead
-- of a Prisma unique-constraint 500. Format regex on the API side:
--   /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
ALTER TABLE "Event" ADD COLUMN "ticketsSlug" TEXT;

CREATE UNIQUE INDEX "Event_ticketsSlug_key" ON "Event"("ticketsSlug");