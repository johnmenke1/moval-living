# Best-Of Share Cards — Implementation Spec

**Date:** 2026-08-22
**Author:** Emma (with Claude's card-design proposal as input)
**Status:** Stage 1 (spike) in progress. Stages 2–4 blocked on the two product decisions below.

## Context

Today, `/best-of/[category]` shares fall back to a generic MoVal OG image. The current Best-Of flow is **editor-curated only** — `BestOfNominee.winner: Boolean` is set by the admin, not by popular vote. The visitor-facing nomination form at `/submit/best-of` is for *suggesting* categories, not voting within them.

The Claude proposal: generate four PNG card types from the database using `next/og`'s `ImageResponse`, plus an embeddable SVG web badge cloned from `/api/partners/badge/[slug]`. Cards are generated on demand, so a name change or a new winner is automatically reflected — no per-season design export.

I (Emma) agree with the architecture and the four-card split. The build order differs from Claude's (see §3) — nominee distribution *before* voter card, because nominee cards are what create the voter pool.

## The two product decisions to lock BEFORE schema work

These are not engineering questions — they encode business policy. Both are blockers for Stage 3.

### Decision A — Live vote counts: visible, hidden, or rank-banded?

**Default I'm proposing: rank-banded (hidden counts) during voting, full reveal at close.**

| Approach | Pros | Cons |
|---|---|---|
| **Live counts** (raw numbers) | Transparent, satisfying | Bandwagon effect — #1 compounds, others stop promoting, voter pool collapses. The campaign's reach depends on every nominee still believing they can win. |
| **Hidden counts** (you voted, that's it) | Cleanest narrative | Feels arbitrary. No reason for a business to push votes mid-window. |
| **Rank bands** ✅ — show "Top 3 / Top 10 / On the bubble / Off the pace" | Drama without runaway. Every nominee is "Top 10" early, which is motivating. Reveals at close are unmissable. | Need UX copy for the band transitions. Band thresholds need a default (proposing Top 3 / Top 10 / Everyone Else). |

**Falls out:** if rank-banded, the voter-card copy becomes "I'm voting for X — currently Top 3" rather than "I'm voting for X — 247 votes and climbing." Both work; just different emotional payload. Pick before the card template is finalized.

### Decision B — Vote integrity primitive

**Default I'm proposing: email-confirmed token opt-in (double opt-in).**

| Approach | Fraud resistance | List-building | Friction |
|---|---|---|---|
| **One-per-browser** (cookie / localStorage) | Low — anyone can clear cookies | None | Zero |
| **One-per-IP** | Low — shared NAT, mobile carriers rotate IPs | None | Zero |
| **CAPTCHA** (hCaptcha / Turnstile) | Medium — defeats scripts, not humans | None | Low (Turnstile is invisible) |
| **Email-token opt-in** ✅ | High — email = unique identity; token = single-use, time-limited | Strong — every voter joins the Best-Of list for next year's outreach | Medium — voter clicks a link in their inbox |

**Falls out:** if email-token, the voter-card share can be triggered *before* confirmation (so the share momentum isn't lost in the inbox roundtrip) but the vote itself only counts after the token is clicked. This is a one-line change in the API and a meaningful UX detail.

**Public-facing rule (must publish on `/how-best-of-works`):** "One vote per email, per category, per season. We confirm via email to prevent ballot stuffing."

## Build order (revised from Claude's)

| Stage | What | Time | Why this order |
|---|---|---|---|
| **1** | Spike `opengraph-image.tsx` on `/best-of/[category]` | 0.5 day | Smallest possible piece. Validates Satori/Next-16 on Vercel. Fixes the current 1200×630 hole. |
| **2** | Nominee batch + email blast | 2 days | Highest-leverage distribution — every business posts their own card to their own IG. This *creates* the voter pool. Must ship before the voter card so the audience is warmed up. |
| **3** | Vote endpoint + voter card + Web Share API | 3 days | The piece that actually spreads. Blocked on Decisions A + B. |
| **4** | Winner card + SVG embeddable badge | 1 day | Announcement day. Cloned from `/api/partners/badge/[slug]`. |

## Schema diff (Stage 3 only — Stages 1, 2, 4 are additive, no migration needed)

```prisma
model BestOfCategory {
  // existing fields stay
  votingOpensAt  DateTime?
  votingClosesAt DateTime?     // null = no live voting (editor-curated mode)
  voteMode       BestOfVoteMode @default(EDITOR_CURATED)  // EDITOR_CURATED | COMMUNITY | HYBRID
}

enum BestOfVoteMode {
  EDITOR_CURATED  // current behavior — admin sets winner: true
  COMMUNITY       // top-N by votes become winners, admin can override
  HYBRID          // community voting ranks, admin promotes final winner(s)
}

model BestOfVote {
  id          String         @id @default(cuid())
  categoryId  String
  category    BestOfCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  nomineeId   String
  nominee     BestOfNominee  @relation(fields: [nomineeId], references: [id], onDelete: Cascade)
  email       String         // hashed at rest (sha256 of email + per-season pepper)
  emailHash   String         // for dedupe lookup
  token       String         @unique // crypto-random, single-use, 7-day expiry
  confirmedAt DateTime?      // null = pending
  expiresAt   DateTime       // confirmed + 7 days
  ipHash      String?        // optional, for rate-limit
  userAgent   String?        // for fraud review
  createdAt   DateTime       @default(now())
  confirmedAt DateTime?

  @@unique([categoryId, emailHash])   // one vote per email per category per season
  @@index([nomineeId])
  @@index([token])
}

model BestOfNominee {
  // existing fields stay
  votes    Int      @default(0)        // denormalized counter; updated atomically on confirm
  voteMode BestOfVoteMode  // mirrors category.voteMode at vote time
}
```

The `votes` counter on `BestOfNominee` is denormalized for fast sort. Updated atomically inside a transaction when a vote is confirmed (not when it's cast — pending votes don't count).

## API surface (Stage 3)

```
POST /api/best-of/[categorySlug]/vote
  body: { nomineeId, email, marketingOptIn }
  → { voteToken, confirmUrl, message: "Check your email to confirm." }
  → 200 even for already-voted (to prevent enumeration); returns same response shape

GET  /api/best-of/vote/confirm?token=<token>
  → 302 to /best-of/[categorySlug]?confirmed=1
  → atomically increments BestOfNominee.votes for the voted nominee
  → marks BestOfVote.confirmedAt
  → fires thank-you email (existing pattern from /api/best-of/nominations)

GET  /api/best-of/[categorySlug]/leaderboard
  → public, returns rank bands only (Top 3 / Top 10 / Everyone else)
  → if voting closed: returns full counts sorted desc
```

Rate-limit: 5 vote-casts per IP per hour (matches the existing `/api/best-of/nominations` rate-limit). Confirmation link itself is single-use.

## Card templates (Stages 1, 2, 4 — Stage 3 blocks on Decision A copy)

### Stage 1 — `/best-of/[category]/opengraph-image.tsx` (1200×630)
- Header: "BEST OF MOVAL 2026" in Fraunces Bold, white, brass-accent
- Body: category name in Fraunces Bold, large, centered
- Subtitle: nominee count + city line ("12 nominees · Moreno Valley")
- Footer: `moval.living/best-of` in Inter SemiBold
- Background: gradient from `bg-primary` to `bg-secondary`
- No logo fetch (keep render time < 500ms)

### Stage 2 — `/api/share-card/nominee/[nomineeId]/route.tsx` (1080×1080)
- Header: "BEST OF MOVAL 2026" small in Inter
- Center: business name in Fraunces Bold (step font size by name length, per Claude)
- Below: "NOMINATED FOR" + category name in Inter
- Footer: "Voting open through Oct 31 · moval.living/best-of"
- If logo exists: small circle, top-right

### Stage 3 — `/api/share-card/voted/[voteId]/route.tsx` (1080×1350)
- Header: "BEST OF MOVAL 2026" + small MoVal badge
- Center: "I VOTED FOR" in Inter SemiBold
- Body: business name in Fraunces Bold
- Below: rank-band copy (Decision A — currently "I'm voting for {name} — Top 3 in Best Coffee Shop")
- CTA: `moval.living/best-of`

### Stage 4a — `/api/share-card/winner/[nomineeId]/route.tsx` (1080×1350)
- Same shape as voter, but copy is "{business} is a 2026 Best Of MoVal winner" and footer is `Voted by Moreno Valley · moval.living`

### Stage 4b — `/api/best-of/badge/[slug]/route.tsx` (SVG)
- Cloned from `/api/partners/badge/[slug]`
- Sizes: `banner=600x140`, `square=320x320`
- Themes: `light` (default), `dark`
- Embed: `<a href="..."><img src=".../api/best-of/badge/slug?size=banner" /></a>`
- Link points back to winner's `/business/[slug]?utm_source=best-of-badge`

## What the spike will validate (Stage 1)

`opengraph-image.tsx` for `/best-of/best-coffee` against the real `BestOfCategory` row. If it renders:
- Confirm render time on Vercel Pro (target: <1s cold, <200ms warm)
- Confirm PNG file size (target: <500KB; if larger, we have a logo/gradient optimization problem)
- Confirm the meta-tag pickup works (paste the URL into iMessage, Slack, Twitter, Facebook, LinkedIn dev tools — all should fetch and cache the OG image)
- Confirm cache headers (Claude suggested `s-maxage=86400` — we'd want `revalidate=3600` ISR on the colocated convention file instead, which Vercel handles natively)

If the spike fails or file size > 1MB, we fall back to a static-Render approach: pre-render the cards at build time into `public/og/`, regenerate via a webhook when a winner changes. More work but more predictable.

## Notes on the Claude proposal I want to amend

1. **Don't delete `best-of-badge.svg`** — it's referenced from 4 places (`/best-of/page.tsx:229,365`, `/dashboard/page.tsx:391`, `BestOfAdmin.tsx:796`). The 746KB file should be optimized (compress to <50KB via SVGO) and kept as the in-page winner indicator. The new dynamic `/api/best-of/badge/[slug]` route handles the *external embeddable badge* use case only.
2. **Story-size card** (1080×1920) is in Claude's SIZES map but no template was shown. I'd add it as a Stage 3 sub-deliverable with the voter card — same content, just a 9:16 crop with the footer re-anchored to the bottom.
3. **Mailto fallback** for the Web Share API on desktop is the right pattern. I'd also add a copy-link fallback (URL with UTM) for users on networks where image-attach is blocked.
4. **Satori font subsetting** — commit only the glyphs we actually use. Pre-render the subset via `glyphhanger` or `fonttools` against a sample of 50 real MoVal business names. Don't load full Fraunces + Inter on every render.

## Verification checklist (per stage)

Stage 1:
- [ ] `npm run build` succeeds
- [ ] Visiting `/best-of/best-coffee` shows the new image in the og-image meta
- [ ] iMessage/Slack/Twitter/Facebook/LinkedIn dev tools show the new image (manual paste test)
- [ ] PNG file size < 500KB
- [ ] Vercel deploy succeeds

Stages 2–4: TBD after Stage 1 ships and we see real Vercel perf numbers.

## Files this will create / modify

Stage 1:
- `src/app/best-of/[category]/opengraph-image.tsx` (new)
- `src/assets/fonts/Fraunces-Bold.subset.ttf` (new, subsetted)
- `src/assets/fonts/Inter-SemiBold.subset.ttf` (new, subsetted)

Stage 2:
- `src/app/api/share-card/nominee/[nomineeId]/route.tsx` (new)
- `src/app/api/admin/best-of/generate-nominee-cards/route.ts` (new — admin action)
- `src/lib/email/best-of-nominee-card.tsx` (new)
- `src/components/admin/BestOfAdmin.tsx` (modify — add "Generate nominee cards" button)

Stage 3 (blocked on Decisions A + B):
- `prisma/schema.prisma` (modify)
- `prisma/migrations/<timestamp>_best_of_voting/` (new)
- `src/app/api/best-of/[categorySlug]/vote/route.ts` (new)
- `src/app/api/best-of/vote/confirm/route.ts` (new)
- `src/app/api/best-of/[categorySlug]/leaderboard/route.ts` (new)
- `src/app/api/share-card/voted/[voteId]/route.tsx` (new)
- `src/components/best-of/VoteButton.tsx` (new)
- `src/components/best-of/ShareVoterCard.tsx` (new — iOS gesture-aware)
- `src/app/best-of/[category]/page.tsx` (modify — wire vote + share)
- `src/lib/email/best-of-vote-confirm.tsx` (new)
- `src/lib/best-of-vote-rate-limit.ts` (new)

Stage 4:
- `src/app/api/share-card/winner/[nomineeId]/route.tsx` (new)
- `src/app/api/best-of/badge/[slug]/route.ts` (new — clone of partners badge)
- `src/components/admin/BestOfAdmin.tsx` (modify — "Announce winners" action)
- `public/best-of-badge.svg` (modify — SVGO compress)
