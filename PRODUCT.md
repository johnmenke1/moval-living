# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Two co-equal audiences with separate journeys:
- **Moreno Valley residents and visitors** finding trusted local businesses, events, parks, homes for sale / open houses, and local stories.
- **Local business owners** who list, claim, and manage a listing, upgrade to paid tiers, and may buy web-design services.

Spanish-speaking residents are a real audience to serve.

## Product Purpose
moval.living (www.moval.living) is a community and business directory for Moreno Valley, California. Success: residents use it as their first stop for anything local, and business owners find it worth listing on and paying for.

Revenue is two-fold: paid listing tiers (Featured $29/mo or $199/yr; Expert Partner $197/mo or $997/yr) and a funnel from unlisted businesses into the moval.living web-design service.

## Positioning
An all-in-one Moreno Valley hub: businesses, events, homes, parks, Best Of community awards, and local stories in a single Moreno-Valley-only place, rather than a generic national directory.

## Operating Context
- Public pages: home, search, category pages, business profiles, deals, events, homes and open houses (CRMLS/Trestle powered), parks, about-Moreno-Valley, Life, Insights, Spotlights, Outings, Best Of, Halloween contest, chambers, partners, pricing, web-design.
- Owners use a dashboard to claim and edit listings, manage reviews, deals and leads; admins moderate submissions, posts, events, and Best Of.
- Seasonal community campaigns (e.g. Halloween entry and voting, with American Legion Post 574 prominent) run on the site.

## Capabilities and Constraints
- Next.js 16 App Router, React 19, Tailwind CSS 4, Drizzle + Postgres, NextAuth v5, Stripe, AWS SES; Vercel hosting (also a vinext/Cloudflare build path).
- Free listing submission with admin approval; claim flow with email verification; reviews; coupons/deals; Expert Partner pages with lead capture (one partner per category).
- The contact-business form was removed (most listings lack valid emails).
- Bilingual/Spanish support: required audience need; extent of implementation is undecided.

## Brand Commitments
Name "moval.living"; tagline "Moreno Valley's Local Business Hub". No visual identity is declared binding: the SPEC.md palette (teal, navy, terracotta), Inter type, and existing logo are the incumbent, not mandated.

## Evidence on Hand
Real listings, categories, events, and local content in the database; logos and imagery in `public/` (including `public/halloween/`, `public/og/`). `public/llms.txt` describes the site for AI crawlers. No customer testimonials or press are recorded; future work must not fabricate them.

## Product Principles
- Local first: everything is about Moreno Valley and credible to people who live there.
- Serve both sides: useful to residents without making owners feel like second-class citizens, and vice versa.
- Trust over volume: curated, accurate, hand-written content beats scraped sprawl.
- One hub, many doors: each surface (businesses, homes, events, parks, stories) should connect to the others.
- Never fabricate proof: no invented reviews, partners, or numbers.

## Accessibility & Inclusion
Serve Spanish-speaking residents. No formal accessibility standard was declared; sensible WCAG practice applies by default.
