-- Record-only migration: documents that the live Neon DB has the Stripe
-- columns on Business (stripeCustomerId, stripeSubscriptionId,
-- subscriptionStatus, subscriptionCurrentPeriodEnd) but the migration file
-- that originally created them is not in the local prisma/migrations/ folder.
--
-- Originally applied directly to production via raw SQL (Neon dashboard) on
-- or around 2026-07-23, before this repo adopted the "every schema change
-- gets a tracked migration" convention. Adding this empty migration brings
-- the local migration history in sync with the live DB so future agents
-- running `prisma migrate status` see a clean baseline.
--
-- DO NOT add DDL here. The columns already exist. This is a marker, not a
-- change. If you need to alter any of the recorded columns, write a NEW
-- migration with a timestamp after this one.

SELECT 1;