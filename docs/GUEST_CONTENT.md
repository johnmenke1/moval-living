# Guest Author / Guest Post Workflow

A guide for adding curated contributors to MoVal Living and publishing their
articles on the site. Built for one admin (you) — no third-party login,
no email round-trips with authors. You write the posts yourself based on
calls / Google Docs / drafts authors send you.

---

## The shape

There are two entities:

- **GuestAuthor** — the public profile (e.g. "Chris Leeper").
  Lives at `/authors/chris-leeper`. Includes bio, photo, company, social links.
- **GuestPost** — an article (e.g. "Is Now the Right Time to Buy in Moreno Valley?").
  Lives at `/insights/is-now-the-right-time-to-buy-in-moreno-valley`.
  Always belongs to one author. Has a workflow status.

Workflow status on a post:
`draft → submitted → in_review → published` (or `rejected`).
`scheduled` is a side branch from in_review/submitted.

**Cadence:** 1 published post per author per calendar month. The system
blocks publishes that would exceed the limit. Drafts and rejected posts don't
count.

---

## To add a new guest author

1. Go to `/dashboard/authors` and click **Add Author** (top right).
2. Fill in:
   - **Display name** (required)
   - **Title** — e.g. "Realtor, Leeper Realty Group"
   - **Slug** — auto-derived from the name; edit only if you need something specific
   - **Bio** — 2-3 sentences. Write this yourself after a 10-min call.
   - **Photo URL** — upload to your media storage, paste the URL
   - **Web presence** — personal site, company name + URL, LinkedIn, etc.
3. Click **Create Author**. You'll land on the editor for that author.
4. The public profile is now live at `/authors/[slug]` (you can preview it).

You can come back and edit any of these fields later.

## To add a post for an existing author

1. Go to `/dashboard/posts-queue` and click **New Post**.
2. Fill in:
   - **Title** (required)
   - **Slug** — auto-derives; edit for SEO
   - **Author** — pick from the dropdown
   - **Excerpt** — 1-2 sentences. Shown in cards and used as the meta description fallback.
   - **Body** — Markdown. Paragraphs, **bold**, *italic*, [links](https://...), ## headings, lists. Images via markdown image syntax.
   - **Hero image** — optional but recommended
3. Click **Save Draft**. You'll land on the post editor.

## To publish a post

1. Open the post at `/dashboard/posts-queue/[slug]`.
2. Review the body. Make any edits.
3. Use the **Workflow** section at the bottom of the editor:
   - **Submit for review** (if status is `draft`) — moves it to `submitted`
   - **Start review** (if status is `submitted`) — moves it to `in_review`
   - **Publish now** — moves it to `published`, live at `/insights/[slug]`
   - **Schedule** — pick a future datetime, status becomes `scheduled`
   - **Reject** — moves it to `rejected`, optional reason
4. From the queue (`/dashboard/posts-queue`), the same actions are available
   as inline buttons next to each post.

## To unpublish

1. Open the post.
2. Workflow section → **Unpublish**. Status returns to `draft`. The URL stops
   returning content.

---

## What lives where

| Where | What |
|---|---|
| `/dashboard/authors` | All guest authors — list, search, edit, soft-disable |
| `/dashboard/authors/new` | Add a new author |
| `/dashboard/authors/[slug]` | Edit one author |
| `/dashboard/posts-queue` | All guest posts — filter by status, search, inline actions |
| `/dashboard/posts-queue/new` | Add a new post |
| `/dashboard/posts-queue/[slug]` | Edit one post + workflow actions |
| `/insights` | Public index of published posts |
| `/insights/[slug]` | Single public post |
| `/authors/[slug]` | Public author profile + list of their posts |

## What the SEO looks like (so you know it's working)

Every public post page emits two JSON-LD blocks:

- **Article** schema with `author` as a `Person`, including the author's
  `worksFor` (Organization), `jobTitle`, and `sameAs` (LinkedIn, Twitter, etc.)
- **Person** schema for the author — the canonical record.

The author page emits its own **Person** schema with the same `sameAs` URLs.
Search engines triangulate: the post references the Person, the Person page
exists, and the post shows up on the Person's "Posts by" list. That's the
authoritativeness signal.

The byline link to the author's company uses `rel="sponsored"` because the
relationship is paid. That's Google-compliant. In-body links (if any) can be
plain `dofollow` — those read as editorial.

## What still needs to happen (your side, before launch)

1. **Run the migration.** `npx prisma migrate dev` (or push to staging first).
2. **Run the seed** for a working author + draft. `npx prisma db seed`.
3. **Pick a real photo for Chris Leeper** and paste the URL into the author editor.
4. **Replace the seed draft body** with Chris's actual draft when you have it.

## Things to know / gotchas

- **Author profiles are admin-only.** Authors never log in. You write everything.
- **Posts are admin-only.** Same.
- **No self-serve portal.** v1 deliberately. If you want authors to log in and
  submit their own drafts later, that's a separate feature.
- **Soft-disable, not hard delete.** Disabling an author hides their profile but
  their published posts stay live. Disabling a post removes it from the public
  index but keeps the URL returning a 404 (not a soft 200).
- **Cadence is calendar-month-based.** It resets at midnight UTC on the 1st.
  Not configurable per author in v1.
- **Slugs are unique across both authors and posts.** If you create a post
  called `/insights/about-chris` it cannot collide with an author at
  `/authors/about-chris` because they're different routes — but two posts
  can't share a slug.

## File map (for future you)

```
prisma/
  schema.prisma                          # GuestAuthor + GuestPost models
  migrations/20260806000000_add_guest_authors/  # new migration
  seed.ts                                # seeds Chris Leeper + draft

src/lib/
  guest-content.ts                       # CRUD + cadence + slug helpers
  markdown.ts                            # sanitized markdown → HTML

src/app/api/admin/
  authors/route.ts                       # GET list, POST create
  authors/[id]/route.ts                  # PATCH, DELETE (soft)
  posts/route.ts                         # GET list, POST create
  posts/[id]/route.ts                    # PATCH content, DELETE
  posts/[id]/status/route.ts             # PATCH workflow state

src/app/dashboard/
  authors/page.tsx                       # admin list
  authors/new/page.tsx                   # create author
  authors/[slug]/page.tsx                # edit author
  posts-queue/page.tsx                   # admin queue
  posts-queue/new/page.tsx               # create post
  posts-queue/[slug]/page.tsx            # edit post + workflow

src/components/admin/
  AuthorsAdmin.tsx                       # authors list client UI
  AuthorEditor.tsx                       # author form
  PostsAdmin.tsx                         # posts queue client UI
  PostEditor.tsx                         # post form + workflow controls

src/app/insights/page.tsx                # public index
src/app/insights/[slug]/page.tsx        # public post (Article JSON-LD)
src/app/authors/[slug]/page.tsx          # public author profile (Person JSON-LD)

src/components/social/SocialIcons.tsx    # added LinkedinIcon, TwitterIcon
```