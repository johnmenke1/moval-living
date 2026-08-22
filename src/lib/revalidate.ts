// On-demand revalidation for ISR'd pages.
//
// The homepage (`revalidate = 300`) and sitemap (`revalidate = 3600`)
// are cached, so admin mutations would otherwise take minutes-to-hours
// to appear. Calling revalidatePath('/') + revalidatePath('/sitemap.xml')
// after the relevant mutation flushes the cache immediately.
//
// Group by *data family* (businesses, events, etc.) — not by route —
// so a single mutation that crosses families can call multiple helpers
// without each helper having to know about siblings. The path list
// per family is the one place to update when new routes adopt ISR.
//
// Routes that are already `force-dynamic` (auth pages, dashboards,
// per-slug detail pages like /business/[slug] and /events/[slug]) do
// NOT need invalidation calls — they re-render on every request.
// Detail pages are listed here only when they're about to switch to
// ISR in a future change.

import { revalidatePath } from 'next/cache'

const HOME = '/' as const
const SITEMAP = '/sitemap.xml' as const

// Businesses appear on the homepage (Featured/Expert Partner/Best-Of
// curated list), in the sitemap (every APPROVED business), on every
// /category/[slug] page (filtered list), and on /best-of (Featured
// winners). The detail page /business/[slug] is force-dynamic —
// no invalidation needed there.
export function revalidateBusinessData() {
  revalidatePath(HOME)
  revalidatePath(SITEMAP)
}

// Events appear on the homepage (HERO/HONORABLE_MENTION strip),
// in the sitemap (every non-archived event), on /events (list),
// and on /events/[slug] (detail, currently force-dynamic).
export function revalidateEventData() {
  revalidatePath(HOME)
  revalidatePath(SITEMAP)
  revalidatePath('/events')
}

// Parks appear in the sitemap (every isActive park) and on /parks
// (list, currently force-dynamic). Detail pages are force-dynamic.
export function revalidateParkData() {
  revalidatePath(SITEMAP)
}

// Editorial posts (GuestPost, postType LIFE/GUEST/OUTING/SPOTLIGHT)
// appear on the homepage (LIFE strip), in the sitemap (all four
// post types), and on the four index pages (/life, /insights,
// /outings, /spotlights — currently force-dynamic) plus their
// detail pages (also force-dynamic).
export function revalidatePostData() {
  revalidatePath(HOME)
  revalidatePath(SITEMAP)
}

// Authors appear in the sitemap (every active author with at least
// one published post) and on /authors/[slug] (currently force-dynamic).
export function revalidateAuthorData() {
  revalidatePath(SITEMAP)
}

// Best-Of categories appear in the sitemap (every published
// BestOfCategory), on /best-of (list, currently force-dynamic),
// plus detail pages. Promoting a nominee to winner also affects
// the business listing, so callers that touch both should call
// both helpers — revalidateBusinessData and revalidateBestOfData.
//
// NOTE: OG cards (public/og/[slug].png) are static PNGs generated
// at build time via scripts/render-og-cards.mjs. They are NOT
// served via revalidatePath — when a winner or category info
// changes, run `node scripts/render-og-cards.mjs` and commit
// the regenerated PNGs. The cards themselves don't appear here
// because static /public/ assets have no ISR layer.
export function revalidateBestOfData() {
  revalidatePath(SITEMAP)
}

// A new BestOfVote (registered-voter voting, .hermes/plans/2026-08-22_best-of-
// registered-voters.md) changes two things on the public category page:
// 1. The vote count above the nominee name
// 2. The VotersFeed entries below the nominee card
// Both are derived at request-time on the category page (force-dynamic),
// so technically revalidatePath isn't needed for them — Next.js will
// re-render on the next request automatically. We still call it for the
// sitemap (vote counts aren't in the sitemap yet but if we ever add
// 'top voted this week' to the sitemap, this hook is in place) and for
// any future ISR'd variant of /best-of/[slug].
//
// Note: the voter-card OG image at /best-of/voted/[voteId]/opengraph-image
// is dynamic (per-user), so revalidatePath('/best-of/voted/[voteId]', 'page')
// would be the right call when we ship that — but until the dynamic OG
// lands, this helper is effectively a no-op for the public surface.
export function revalidateBestOfVoteData() {
  // Intentionally empty for now — see comment above.
}

// A category's name/description/icon appears on /category/[slug]
// (every category page lists all categories in the breadcrumb/nav)
// and in the homepage category grid. Not in the sitemap (the
// static `/category/[slug]` entries don't reflect per-business
// counts at the sitemap level).
export function revalidateCategoryData() {
  revalidatePath(HOME)
}
