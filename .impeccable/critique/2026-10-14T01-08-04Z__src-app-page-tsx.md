---
target: homepage
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:C:\\projects\\websites\\moval-living\\src\\app\\page.tsx"
target_fingerprint: "sha256:b3502b653a25733e44eea4345a346e581cd8fa298a4f7919ff0348a0c95842b8"
target_path: "C:\\projects\\websites\\moval-living\\src\\app\\page.tsx"
timestamp: 2026-10-14T01-08-04Z
slug: src-app-page-tsx
---
Method: dual-agent (A + B). Caveat: localhost:3000 served a different app, so no browser evidence; Assessment A is source-based.

# Critique: homepage (src/app/page.tsx + src/components/home/*)

Score 25/40 (all heuristics applied).

Specificity verdict: ~35% authored. Local hero video and neighborly H1 are real; skeleton is a generic directory template; DESIGN.md "Valley Storefront" not delivered on the homepage.

Priority issues
1. [P1] Hero decision overload (HomePageClient.tsx:183-228): ~9 controls. /impeccable distill
2. [P1] Ticker + auto-rotating events strip sit between hero and content. /impeccable distill
3. [P1] Auto-advancing motion (EventsCallout.tsx:268-288, ticker 7s) has no touch/explicit pause (WCAG 2.2.2). /impeccable harden
4. [P2] Design system not delivered: plain bold Inter headings, off-palette ticker hues, hover scale. /impeccable typeset, then bolder
5. [P2] Featured vs Best Of vs Nominated unexplained; paid placement unlabeled; empty state col-span-3 breaks at 1 col (:372). /impeccable clarify
6. [P3] CTA band unevidenced claim and off-token hover (:498, :501). /impeccable polish

Detector: 6 advisory findings (EventsCallout.tsx 8-11px text at :338,342,349,353,375; rgba tint at :72).

Personas: Jordan (first-timer) and Casey (mobile) red flags: jargon, 22-option select + 22 tiles, auto-advance carousel, 8-11px event text, hidden ticker time-ago.
