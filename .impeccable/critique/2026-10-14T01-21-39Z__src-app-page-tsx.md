---
target: homepage
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\projects\\websites\\moval-living\\src\\app\\page.tsx"
target_fingerprint: "sha256:b3502b653a25733e44eea4345a346e581cd8fa298a4f7919ff0348a0c95842b8"
target_path: "C:\\projects\\websites\\moval-living\\src\\app\\page.tsx"
timestamp: 2026-10-14T01-21-39Z
slug: src-app-page-tsx
---
Method: dual-agent (A + B). Run 2 on the homepage, real moval dev server on :3100. Hero poster failed to load locally; no events/activity data locally.

Score 25/40 (all heuristics applied).

Verdict: half authored (voice, curation note, Se habla espanol), half template (hero > search > cards > 22 icon tiles > CTA). Local identity rests on one remote hero poster.

Priority issues
1. [P1] Featured grid undercuts trust: boilerplate "A [category] spot in Moreno Valley", ~700-char description, 2-3 badges per card. /impeccable distill then clarify
2. [P1] Local identity rests on one remote asset; poster failure leaves white H1 on grey. /impeccable harden then bolder
3. [P2] No doors to Events/Homes/Parks/Best Of on homepage. /impeccable layout
4. [P2] Coral overused (hero Search + CTA + Featured); badge/footer contrast (Expert Partner 2.3:1, Espanol 2.6:1, footer 3.8:1). /impeccable colorize then polish
5. [P3] 22-tile category wall. /impeccable distill

Detector: static scan 0 findings; live detector 8 (low-contrast x6, cramped-padding x1, dark-glow x1).
Measured: 31 interactive elements under 44px on mobile (header Pricing/Best Of/menu, social icons).

Found and fixed during this run: the .text-primary dark-teal override in globals.css had invalid selectors (lost backslash escapes) and never applied; now computes rgb(0,122,127).
