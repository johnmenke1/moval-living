-- Rename Event.ticketsSlug → Event.shareUrl + drop the @unique constraint.
-- Reason: ticketsSlug was designed for the /tickets/[slug] redirector route,
-- but moval.living doesn't sell tickets. The actual use case is "where should
-- the public event card click go?" — full URLs like moval.gov/parks-comm-svc/
-- event-day-of-service.html. shareUrl accepts either a full URL or a path slug;
-- admin's choice. No uniqueness constraint (multiple events can legitimately
-- share the same upstream URL if they come from the same source post).
--
-- Data preserved: existing ticketsSlug values are carried into shareUrl
-- unchanged — they remain valid share URLs (path slugs like "teen-silent-
-- summer-bash" continue to work).

ALTER TABLE "Event" RENAME COLUMN "ticketsSlug" TO "shareUrl";

DROP INDEX "Event_ticketsSlug_key";