-- Add FOOD_DRINK and HOLIDAY_CELEBRATIONS to EventCategory enum.
-- Existing 7 values (SPORTS, MUSIC, ARTS, EDUCATIONAL, FUNDRAISERS, COMMUNITY, FAMILY)
-- were created out-of-band; this migration just adds the 2 new ones.
--
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block, so this
-- migration has no BEGIN/COMMIT wrapper.

ALTER TYPE "EventCategory" ADD VALUE IF NOT EXISTS 'FOOD_DRINK';
ALTER TYPE "EventCategory" ADD VALUE IF NOT EXISTS 'HOLIDAY_CELEBRATIONS';
