---
title: /web-design premium refresh — spec
date: 2026-08-26 13:00 PDT
status: draft — awaiting Johnny's sign-off
branch: feat/web-design-premium-refresh (worktree)
author: Molly
---

# Goal

Make `/web-design` feel premium-modern and visually arresting so a local
business owner lands on the page, scrolls once, and thinks "I want that."
Keep the existing page structure and copy — what changes is the *feel*:
typography, color, motion, and one signature moment.

# What's already shipped (do not rebuild)

- `src/app/web-design/page.tsx` — Server Component shell with metadata + Service JSON-LD
- `src/app/web-design/WebDesignClient.tsx` — full client page (634 LOC)
- `src/app/web-design/Motion.tsx` — motion primitives: Reveal, AnimatedNumber, MagneticButton, Marquee, AmbientOrbs, ShimmerText
- `public/web-design-hero-demo.mp4` — 4.4 MB demo video already referenced

# Why this exists (not the Freshman version)

There is a `remotes/origin/design-refresh` branch but it's the
2026-08-15 community-first *homepage* refresh. Unrelated to /web-design.
The "Freshman cinematic" version was `6cccf31` (you authored it, you
reverted in 12 min via `c2ab45f`). My read: it overcorrected into Linear
territory — pure black + single red + Fraunces extralight — and lost the
existing teal/navy identity. We're not repeating that mistake.

# North star: keep the brand identity, push the polish

- Brand: teal `#007a7f` + navy `#00405c` + warm accent `#c9786d` (existing palette in `globals.css`)
- Body type: Inter (existing)
- Display type: Fraunces with the **`opsz` axis** (already loaded in `layout.tsx` as `--font-fraunces`)
- The current page is "too corporate default Tailwind." Premium = deliberate type choices, real color contrast, motion that earns its keep.

# Concrete change list (12 items, all small, none breaking)

## 1. Install Framer Motion (`motion` package, the rebranded successor to `framer-motion`)

```bash
pnpm add motion
```

Why this lib: ~50KB gz, designed for React 19 + Next 16 App Router, has scroll-linked animations + parallax + spring physics + the kind of staggered reveals premium landing pages use. Reusable on /best-of hero, /pricing, future landing pages. GSAP is heavier and harder to share. Hand-rolled CSS+IO can't do spring physics or scroll-linked parallax without reinventing the wheel.

**Why not just `framer-motion`:** the package was renamed to `motion` in 2024. New code should use `motion` directly. Both work; `motion` is the maintained one.

## 2. Move motion primitives from `Motion.tsx` → `src/components/motion/`

Create:
- `src/components/motion/Reveal.tsx`
- `src/components/motion/AnimatedNumber.tsx`
- `src/components/motion/MagneticButton.tsx`
- `src/components/motion/Marquee.tsx`
- `src/components/motion/AmbientOrbs.tsx`
- `src/components/motion/ShimmerText.tsx`
- `src/components/motion/ParallaxCardStack.tsx` (new — see #6)
- `src/components/motion/TextReveal.tsx` (new — see #5)
- `src/components/motion/index.ts` (barrel export)

The components keep the same API as the current `Motion.tsx` exports. The page imports change from `./Motion` to `@/components/motion`. This makes the motion library reusable across pages without re-coupling.

## 3. Add `TextReveal` component

A headline that splits on words (or chars) and animates each one in with a stagger. Uses Framer Motion's `useInView` + stagger children.

```tsx
<TextReveal
  as="h1"
  className="font-fraunces text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95] font-light tracking-[-0.04em]"
  delay={0.1}
>
  A website that works as hard as your business does
</TextReveal>
```

Words fade + slide up 12px with 40ms stagger. Replaces the current `<h1><ShimmerText>` block.

## 4. Add a refined color system (palette tokens in `globals.css`)

The current `--color-accent: #c9786d` works. What's missing is a **saturated accent for hero highlights** and a **dark surface** for the demo-browser section. Add:

```css
:root {
  --color-accent-bright: #e8896e;  /* hero highlight, hover states */
  --color-surface-dark:  #0e2a32;  /* deep teal-navy for dark sections */
  --color-surface-deep:  #082025;  /* deepest, used behind hero demo */
  --color-text-on-dark:  #e6efea;
  --color-line:          rgba(26, 46, 53, 0.08);  /* hairline borders */
  --color-line-strong:   rgba(26, 46, 53, 0.16);
}
```

These are the *premium* edges — sat accents, real darks (not pitch black), hairline borders instead of `border-slate-200`.

## 5. Replace `border-slate-200` / `border-slate-100` everywhere in `WebDesignClient.tsx`

Map to `border-[color:var(--color-line)]` for default hairlines and `border-[color:var(--color-line-strong)]` for emphasis. Same density, custom edge. Removes the "default Tailwind" tell.

## 6. The signature moment — `ParallaxCardStack`

This is the "I want that" beat. Three browser-window mockups stacked with `transform-style: preserve-3d`, mouse position rotates the stack up to ±6° on X/Y axes. The lead card (foreground) shows the existing `web-design-hero-demo.mp4` looping. Behind it: card 2 shows a static SVG/HTML mockup of a "5-Star Review Funnel" screenshot. Card 3 shows a "Missed Call Text Back" notification mockup.

Why this lands: it's the **Linear pricing card move** — the kind of thing that makes prospects stop scrolling and watch. It's also visibly different from the Freshman version (which had no 3D).

```tsx
<ParallaxCardStack
  leadCard={<DemoBrowser />}  // existing component
  cards={[<ReviewFunnelMockup />, <MissedCallMockup />]}
  rotateStrength={6}  // max degrees
/>
```

~150 LOC. Pure CSS 3D + a small mouse-move listener. Wraps with `prefers-reduced-motion` respect.

## 7. Hero copy stays, typography shifts

Current hero: `<h1 className="font-bold">` with Inter.

New hero:
- `<TextReveal as="h1" className="font-fraunces font-light tracking-[-0.04em] text-[clamp(2.75rem,7vw,5.5rem)] leading-[0.95]">`
- Drop "Best Value" amber pricing tier's `from-amber-500 to-yellow-400` → swap to a `--color-accent-bright` orange and pair it with a subtle border-glow. The amber gold reads as a *different* brand; warm-orange stays on-palette.
- Magnetic buttons: keep but add `whileHover` spring from Framer Motion for a real feel. Replace the manual `onMouseMove` math in `MagneticButton.tsx` with `motion.a` + `whileHover={{ scale: 1.03 }}`.

## 8. Trust bar — add a real animated illustration

Currently four numbers in a grid. Replace with: numbers + a thin animated line/dot pattern that draws under them as they count up. Use Framer Motion's `motion.svg` with a path-length animation. ~30 LOC. Looks editorial, not default.

## 9. Pricing — Premium tier gets a glow

Add a soft outer glow to the Premium card on hover using a box-shadow layered with `--color-accent-bright`. The pricing section already has the `pulse-glow` keyframe — reuse it.

## 10. FAQ accordion — minor motion upgrade

Replace the manual `Rotate90` arrow with a Framer Motion `<motion.div animate={{ rotate: openFaq === i ? 90 : 0 }}>`. Same visual result, smoother, library-rendered so other pages can copy-paste.

## 11. The shimmery "live" badge in the hero

The existing eyebrow pill ("Setup & onboarding (a $497 value) is on us — limited time") gets a subtle left-to-right gradient sweep using a CSS keyframe (already in `Motion.tsx` as `ShimmerText`). Apply it to the badge background, not the text.

## 12. Final CTA — make it the closer

Wrap the existing final CTA in a `<motion.section>` with a scroll-linked scale + opacity reveal. As the user scrolls into it, the card grows from 96% → 100% and the orbs behind it brighten. Subtle but rewarding.

# What stays untouched (explicit non-goals)

- Service JSON-LD in `page.tsx`
- Booking URL, phone number, FAQ copy
- LeadForm component (works, ships leads)
- Pricing tier structure ($97 / $297)
- DemoBrowser video element + .mp4 file
- Tier feature lists
- The `revolutions-reel` of vertical categories

# Files touched

- `package.json` (+ `motion`)
- `src/app/globals.css` (palette tokens, no other change)
- `src/app/web-design/page.tsx` (no change)
- `src/app/web-design/WebDesignClient.tsx` (heavy edit — copy stays, classNames change)
- `src/app/web-design/Motion.tsx` → split into `src/components/motion/*.tsx`
- New: `src/components/motion/ParallaxCardStack.tsx`, `TextReveal.tsx`, mockup components
- New: `src/components/motion/Mockups/ReviewFunnelMockup.tsx`, `MissedCallMockup.tsx` (simple HTML/SVG mocks)

# Risks

1. **Library install could surface React 19 + Next 16 compat issues.** Mitigation: the `motion` package is purpose-built for modern React Server Components. If install + dev server show any hydration warnings, I'll fall back to the existing hand-rolled CSS approach for the affected motion and keep the lib for the *new* components (ParallaxCardStack + TextReveal).
2. **`ParallaxCardStack` could feel jittery on weak GPUs.** Mitigation: `will-change: transform` only while mouse is moving, off after 200ms idle. Tested with the existing `AmbientOrbs` already use this pattern.
3. **Color tokens could clash with the existing palette elsewhere on the site.** Mitigation: new tokens are *additions* to `:root`, no overrides of existing `--color-primary` / `--color-accent`. The other pages keep their current colors.

# Verification

1. Run `pnpm dev`, navigate to `http://localhost:3000/web-design` (worktree).
2. Screenshot at 1440px, 768px, 375px via Playwright (already in devDependencies).
3. Verify: hero loads with text-reveal stagger, demo video loops, parallax card stack tilts on mouse move, pricing glow on hover, FAQ accordion animates, no console errors.
4. Lighthouse perf: target ≥ 90 on /web-design desktop (current is ~95; `motion` adds ~50KB gz).
5. Reduced-motion: enable in OS, verify animations skip cleanly.

# Rollback

- Single commit: `feat(web-design): premium refresh — Framer Motion + Fraunces display + parallax card stack`
- Revert via `git revert <sha>` if anything looks off after deploy
- The motion lib install is a separate commit so we can also `pnpm remove motion` independently if it causes issues on other pages

# Out of scope (mention so I don't drift)

- /pricing page — separate page, not touched
- Other pages (events, best-of, etc.) — these would benefit from the motion lib later but that's a follow-up
- New demo video asset — reuse existing .mp4
- Copy / headline rewrites — all copy stays as-is
