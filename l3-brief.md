# L3 Brief — "A Local's Guide to Moreno Valley Neighborhoods: Where to Actually Live"

**Author:** John Menke (you)
**Lane:** /life (Life in MoVal)
**Target length:** ~1,300-1,500 words
**Publish target:** When you say go

---

## 1. Why this piece matters

Two reasons. First, the keyword "best neighborhoods in Moreno Valley" (and the variants "where to live in Moreno Valley," "Sunnymead Ranch," "TownGate Moreno Valley") has real search intent — people Google this before they move. Second, every other page on the site about neighborhoods is currently missing it (`/about-moreno-valley` has no neighborhood copy; `/homes` is an inventory view; `/best-of` is competitive). This article becomes the canonical on-voice neighborhood piece, with internal links from it into `/homes`, `/search?category=real-estate`, and the 38 real-estate business listings.

## 2. The 6 neighborhoods (verified real)

| # | Neighborhood | Geography / vibe | One specific anchor |
|---|---|---|---|
| 1 | **Sunnymead Ranch** | East side, master-planned, gated portions, the post-2000 buildout | Leeper Realty Group (already EXPERT_PARTNER in DB) — `leeper-realty-group-*` |
| 2 | **TownGate** | Central, walkable shopping + dining, Moreno Beach Mall area | The Cupcake & Espresso Bar at TownGate (from L1) |
| 3 | **Sunnymead Blvd corridor** | Original 1936 community, the MoVal "main drag," Blue Beetle / Ranch Deli territory | JK Jalisco's Kitchen, Ranch Deli & Grill |
| 4 | **Canyon Springs** | East-side upscale enclave around Canyon Crossings Pkwy | Canyon Crossings |
| 5 | **Edgemont** | Oldest community (1940), original founding village, central-warm spot on Heacock | Heacock medical cluster (Loma Linda, Rancho Medical) |
| 6 | **Moreno Valley Ranch / Hidden Springs** | South end, larger lots, equestrian-adjacent, newer builds | TBD — pick whichever fits your voice better |

If 5 and 6 feel too similar in your head, swap one for **Rancho Belago** (western, planned 3,150-residence community per the city's own planning docs) or **Iris Ave** (medical/business corridor).

## 3. Voice + framing

First-person, bylined you. Same register as L1 + L2. Local's recommendation, not a Zillow listing copy. One honest tradeoff per neighborhood. Read-aloud test: would you say this to a friend who asked "I'm thinking about moving to MoVal — where should I look?"

Examples of "voice you, voice not you":
- ✅ "Sunnymead Ranch is where most people end up if they're moving here with kids in tow."
- ❌ "Sunnymead Ranch offers an exceptional array of amenities including resort-style pools and pristine walking trails."

## 4. Structure (target ~1,400 words total)

- **Opener** (100-150w): The "I'll give you the real version" framing. Maybe one sentence about how every neighborhood has a personality and you've watched all of them change since '90.
- **Six neighborhood profiles** (~180-220w each):
  - H2 heading with the neighborhood name
  - Where it is (which streets/borders/anchor intersection)
  - What kind of buyer fits there (family, first-time, retiree, commuter, equestrian, etc.)
  - 1 specific anchor (restaurant, school, park, church, etc.) — name the actual place
  - 1 honest tradeoff (traffic, HOA, distance, price, age of homes, etc.)
  - 1-2 inline links to `/business/[slug]` for businesses in that area
- **Closer** (150w): The "which one fits you" decision guide + soft CTA pointing to your RE business. Suggested framing: "If you're trying to figure out which neighborhood fits you, I'd be happy to walk you through the tradeoffs in person. Reach out."

## 5. Internal links (target: 8-10 total)

- 6-8 × `/business/[slug]` — one or two per neighborhood where a real listing exists
- 1 × `/search?category=real-estate` (closer) — "see all 38 real-estate businesses"
- 1 × `/homes` (closer) — "browse open houses"
- 1 × `/about-moreno-valley` (light, optional)

## 6. Soft CTA (this article only)

> If you're trying to figure out which neighborhood fits you, I'd be happy to walk you through the tradeoffs in person. Reach out and we'll talk.

Justified because the article literally helps people make a real estate decision. No form wall, just a contact invitation. Your `/about-moreno-valley#about-john` already lists your contact info, so this is a gentle nudge, not a hard sell.

## 7. Verified DB slugs to link to

| Business | Slug | Used for neighborhood |
|---|---|---|
| Leeper Realty Group | `leeper-realty-group-*` (FEATURED or EP) | Sunnymead Ranch |
| The Cupcake & Espresso Bar (TownGate) | `the-cupcake-espresso-bar-g4kXA1` | TownGate |
| Sonora Grill | `sonora-grill-CpQvXR` | TownGate |
| JK Jalisco's Kitchen | (lookup slug) | Sunnymead Blvd |
| Ranch Deli & Grill | (lookup slug) | Sunnymead Blvd |
| Canyon Crossings | (lookup slug) | Canyon Springs |
| Black Bear Diner Moreno Valley | (lookup slug) | Sunnymead Ranch |
| Loma Linda University Health Care (Heacock) | (lookup slug) | Edgemont |

I can pre-look these up before you write so the slugs are ready in a scratchpad.

## 8. Meta + schema (I'll wire these)

- **Slug:** `a-guide-to-moreno-valley-neighborhoods`
- **Title:** "A Local's Guide to Moreno Valley Neighborhoods: Where to Actually Live"
- **metaTitle:** "Best Neighborhoods in Moreno Valley: A Local's Guide (2026)" (~52 chars)
- **metaDescription:** ~155 chars (I'll draft from your opening line)
- **Excerpt:** First ~155 chars of your opener
- **postType:** `LIFE`
- **authorId:** `cmsrqk9tc0000vcu9d0k4amwx` (your author profile)
- **JSON-LD Article + author** — already wired in `/life/[slug]/page.tsx`
- **Canonical:** `https://www.moval.living/life/a-guide-to-moreno-valley-neighborhoods`

## 9. Verification (before publish)

- Word count: 1,200-1,500
- 6+ unique neighborhood profiles, each with 1+ inline business link
- Every business slug resolves to HTTP 200
- No neighborhood claimed that you can't personally vouch for (I'll defer to you)
- No Zillow-style census stats — those belong on `/about-moreno-valley`

## 11. Workflow when you hand me text

1. You paste the article (or drop a file in the project)
2. I look up DB slugs for any businesses you mention, format the markdown with H2s/H3s, build internal links
3. I write it to the DB as `status: 'draft'` and show you the rendered preview
4. You approve → I flip status to `published` (1-line DB update)
5. It appears on `/authors/john-menke`, `/life`, the homepage callout, and (after Vercel cache refresh) the sitemap

---

## What I need from you before you write

**Just one thing:** tell me which6 neighborhoods you actually want to write about. The list above is my best guess from city history + DB coverage, but you're the one who's lived here since 1990 — your picks might be totally different. If you want to write about Iris Ave or Alessandro corridor or something I haven't named, that's fine, I'll adapt.