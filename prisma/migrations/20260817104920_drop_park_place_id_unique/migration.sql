-- DropUniqueIndex on Park.googlePlaceId
--
-- Reason: Multiple parks can legitimately resolve to the SAME
-- Google Place id (e.g., two parks sharing an address, a park
-- whose Google entry is shared with a non-park landmark). The
-- @unique constraint was an over-reach that prevented
-- scripts/enrich-park-photos.mts from completing enrichment
-- for parks whose Google ID collides with a sibling park's.
--
-- The index is dropped; no replacement index needed since
-- placeId lookups by id aren't a hot-path query (we always
-- select parks by slug, type, or via filter chips; we never
-- query by googlePlaceId).

DROP INDEX IF EXISTS "Park_googlePlaceId_key";
