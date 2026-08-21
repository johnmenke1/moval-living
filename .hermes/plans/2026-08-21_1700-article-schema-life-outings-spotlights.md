# Article + VideoObject schema for Life / Outings / Spotlights — 2026-08-21

## Goal

Add Schema.org `Article` JSON-LD to every published post on
`/life/[slug]`, `/outings/[slug]`, and `/spotlights/[slug]`. Add
Schema.org `VideoObject` JSON-LD to spotlights (which embed YouTube
via `youtubeVideoId`). Match the shape already shipping on
`/insights/[slug]/page.tsx` so all four post surfaces are
structurally consistent for crawlers.

## Why now

- E-E-A-T signal for AI engines. AI crawlers (Perplexity, ChatGPT,
  Claude) and Google AI Overviews all read `Article` structured
  data to decide whose local claims to trust. A post with
  `author`, `datePublished`, and `dateModified` schema is more
  citable than an identical post without it.
- Consistency. The four post surfaces (Insights, Life, Outings,
  Spotlights) all serve the same `GuestPost` model with a
  `postType` enum discriminator. They should emit the same
  primary schema.
- Spotlights are short-form video. `VideoObject` schema is the
  direct equivalent of `Article` for video content — Google uses
  it for video search features (key moments, video carousels).
  Without it, our spotlights are invisible to those surfaces.

## Source of truth

`src/app/insights/[slug]/page.tsx` lines 70–137. Three blocks:

1. `articleSchema` — `@type: Article` with author (Person),
   publisher (Organization), `datePublished`, `dateModified`,
   `headline`, `description`, `image`, `mainEntityOfPage`.
2. `personSchema` — `@type: Person` with bio, photo, social links,
   company affiliation. Standalone block (separate E-E-A-T signal
   for the author).
3. `faqSchema` (lines 142–153) — `@type: FAQPage` when
   `post.faqItems` is non-empty. Already conditional; carry the
   same conditional into the new files.

## Scope

### In scope (this commit)

- `src/app/life/[slug]/page.tsx` — add all three schema blocks.
- `src/app/outings/[slug]/page.tsx` — add all three schema blocks.
- `src/app/spotlights/[slug]/page.tsx` — add Article + Person + FAQ,
  plus a new `VideoObject` block when `post.youtubeVideoId` is set.

### NOT in scope

- The `src/app/life/page.tsx`, `src/app/outings/page.tsx`,
  `src/app/spotlights/page.tsx` index pages. They serve list-style
  content (post cards, not individual articles). Article schema
  applies to the individual post pages, not the lists.
- Adding a `videoUrl` field. `youtubeVideoId` already exists on
  `GuestPost`; we use it directly to construct the YouTube
  watch URL. No schema migration.
- Adding `articleBody`. Some schemas include it, but it's redundant
  with `description` and the page's visible body, and Google
  doesn't require it.

## Open decisions and how I'm resolving them

### D1 — author fallback when a post has no author relation

The Insights page does `if (!author) notFound()` — Insights
posts *require* an author. But Life, Outings, and Spotlights
all handle `post.author` as nullable in the visible UI (the
byline component renders "by moval.living" or similar fallback
when null).

For Article schema, Google expects an `author` field. The
Schema.org spec accepts either a `Person` or an `Organization`
as the author. The publisher is already an `Organization` (the
`moval.living` block), so author = publisher is a clean fallback.

**Decision:** if the post has an author, emit the same
`author: { @type: 'Person', ... }` block as Insights. If not,
emit `author: { @type: 'Organization', name: 'MoVal Living', url: 'https://www.moval.living' }` (the publisher's identity).

Either way, Article schema is valid and useful. The standalone
`Person` block (separate E-E-A-T signal) is only emitted when
a real author exists — there's no value in a Person block for
an organization.

### D2 — the Life/Outings author `select` is incomplete

`life/[slug]/page.tsx` and `outings/[slug]/page.tsx` query the
author with a narrow `select` (slug, displayName, title,
companyName, photoUrl). The Person schema needs more (bio,
companyUrl, linkedinUrl, twitterUrl, personalSiteUrl,
facebookUrl, instagramUrl). The visible UI doesn't currently
use those fields, but the JSON-LD block does.

**Decision:** expand the `author: { select: {...} }` to include
all the fields the Person schema uses. This is a one-time
query change per page; no schema migration; the new fields
are already in the database (the `GuestAuthor` model has
them).

`spotlights/[slug]/page.tsx` already uses `include: { author: true }`
which fetches all scalar fields, so no change needed there.

### D3 — VideoObject shape for Spotlights

The recommendation says "VideoObject schema since they're
short-form video." Spotlights embed YouTube via
`post.youtubeVideoId`. The right shape:

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "<post.title>",
  "description": "<post.excerpt>",
  "thumbnailUrl": "<post.heroImageUrl>",
  "uploadDate": "<post.publishedAt.toISOString()>",
  "contentUrl": "https://www.youtube.com/watch?v=<id>",
  "embedUrl": "https://www.youtube.com/embed/<id>"
}
```

**Decision:** emit VideoObject when `post.youtubeVideoId` is
present. If not present (some spotlights might just be a photo
+ text without video), skip the VideoObject — a spotlight
without video is just an Article. No fallback shape.

If `post.heroImageUrl` is missing, the `thumbnailUrl` is also
omitted (youTube's auto-thumbnail will be used by Google Video
Search instead — that's fine).

## Files touched

- `src/app/life/[slug]/page.tsx` — expand `author.select`, add
  Article + Person + FAQ blocks
- `src/app/outings/[slug]/page.tsx` — same
- `src/app/spotlights/[slug]/page.tsx` — already has full
  author `include`, just add the schema blocks + VideoObject

## Implementation order (per file)

1. Read the file (already done in this commit's preflight).
2. Add the `JsonLd` import if not present (it isn't on any of
   the three targets).
3. Expand the `author` query if needed (life, outings).
4. Add the schema-building code right above the JSX return
   statement, following the Insights page's structure.
5. Add `<JsonLd schema={...} />` blocks as the first children
   of the page wrapper (server-rendered, in initial HTML, so
   AI crawlers see them).
6. `npx tsc --noEmit` clean.
7. Commit.
8. After the third file, wait for Vercel deploy, then verify
   live with one curl per page type.

## Verification (post-deploy)

```bash
# Article schema in initial HTML
curl -sL https://www.moval.living/life/<slug>     | grep -c '"@type":"Article"'
curl -sL https://www.moval.living/outings/<slug>  | grep -c '"@type":"Article"'
curl -sL https://www.moval.living/spotlights/<slug-with-youtube> | grep -c '"@type":"Article"'
# expect: 1 each

# Person schema (only when post has author)
curl -sL https://www.moval.living/life/<slug>     | grep -c '"@type":"Person"'
# expect: 1 (if author) or 0 (if no author)

# VideoObject (only on spotlights with youtubeVideoId)
curl -sL https://www.moval.living/spotlights/<slug-with-youtube> | grep -c '"@type":"VideoObject"'
# expect: 1

# Same for control: insights should still have Article + Person
curl -sL https://www.moval.living/insights/<slug> | grep -c '"@type":"Article"'
# expect: 1 (regression check — should still work after my changes)
```

## Risks

- The expanded `author.select` on Life and Outings is a one-time
  data change with no UI impact (the new fields aren't rendered
  visibly anywhere). Prisma is fine fetching them.
- The `Person` schema block uses `author.bio` which is a `@db.Text`
  field. Long bios could blow up the JSON-LD size. The Insights
  page already does this without issue, so the limit is known.
- If a Life or Outings post is published without an `authorId`,
  the Article schema will use the Organization fallback. That's
  correct behavior, not a bug.
