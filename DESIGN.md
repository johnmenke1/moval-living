---
name: MoVal Living
description: Moreno Valley's Local Business Hub
colors:
  primary: "#00a8a8"
  primary-dark: "#007a7f"
  midnight: "#061f2e"
  midnight-light: "#0b3a52"
  coral: "#ff7a66"
  coral-dark: "#e85d4a"
  coral-strong: "#c8402e"
  coral-deep: "#b0331f"
  teal-deep: "#00666b"
  gold: "#f3c46c"
  mist: "#f8f9fb"
  surface: "#ffffff"
  ink: "#081820"
  slate: "#5a6c72"
  success: "#22C55E"
  error: "#EF4444"
typography:
  display:
    fontFamily: "Fraunces, Inter, sans-serif"
    fontWeight: 700
    letterSpacing: "-0.025em"
    lineHeight: 1.25
  headline:
    fontFamily: "Fraunces, Inter, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    letterSpacing: "-0.02em"
    lineHeight: 1.25
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
rounded:
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
spacing:
  section-top: "4rem"
  section-bottom: "5rem"
  gutter: "1rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.5rem"
  button-accent:
    backgroundColor: "{colors.coral}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.5rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "0.75rem 1.5rem"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  input:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "0.875rem 1rem"
---

# Design System: MoVal Living

## Overview

**Creative North Star: "The Valley Storefront"**

The site behaves like a well-kept main street: bright, inviting, and a little showy about local pride. Deep midnight navy provides the frame, vivid teal is the welcome mat, and coral and gold are the window signage that says "look here." Headlines use a warm serif (Fraunces) so pages read like a hometown publication, while Inter keeps listings, forms, and prices plain and fast to scan.

Surfaces are soft, rounded, and lifted: cards sit on a cool near-white page, rise four pixels on hover, and primary buttons carry a tinted glow. Density is moderate and card-based; every page is built from the same few parts so a business listing, an event, and a park feel like neighbors.

**Key Characteristics:**
- Navy-and-teal base with coral and gold as deliberate accents
- Serif headlines over a sans body
- Rounded (12-16px) cards, buttons and inputs
- Ambient, tinted shadows and lift-on-hover states
- Gradient fills on primary actions; mesh and midnight gradients for hero bands
- Mobile-first, content width capped at 80rem

## Colors

A saturated teal and midnight-navy core with warm coral and champagne-gold accents on a cool, near-white page.

### Primary
- **Storefront Teal** (#00a8a8): Links, focus rings, outline buttons, primary-button gradient start.
- **Deep Harbor Teal** (#007a7f): Gradient end of primary buttons, hover text, glow shadows. Also the legacy brand teal from SPEC.md.

### Secondary
- **Midnight Navy** (#061f2e): Hero and band backgrounds, code blocks, dark text surfaces.
- **Evening Navy** (#0b3a52): Gradient partner for midnight bands; inline code text.

### Tertiary
- **Awning Coral** (#ff7a66): Featured listings (2px border), accent buttons, gradient text partner.
- **Hot Coral** (#e85d4a): Accent-button gradient end and shadow tint.
- **Champagne Gold** (#f3c46c): Highlights and awards moments (Best Of); used sparingly in mesh backgrounds.

### Neutral
- **Cool Mist** (#f8f9fb): Page background.
- **Paper White** (#ffffff): Cards, header, inputs.
- **Shop Ink** (#081820): Body text.
- **Slate Gray** (#5a6c72): Secondary text, captions.
- **Signal Green** (#22C55E) / **Alert Red** (#EF4444): Success and error states only.

### Named Rules
**The Text-Safe Teal Rule.** Bright teal (#00a8a8) is a fill, ring and dark-band colour only. Teal text and button fills on white use Deep Harbor Teal (#007a7f, ~5.1:1) or Teal Deep (#00666b); coral button fills use #c8402e to #b0331f so white text passes 4.5:1. The global CSS maps `.text-primary` to the dark teal and restores bright teal inside dark bands.

**The Featured Coral Rule.** Coral marks paid or featured placement and the single most important action on a screen. If everything is coral, nothing is featured.

**The Midnight Frame Rule.** Dark navy bands are for hero and campaign moments; content pages stay on Cool Mist and Paper White.

## Typography

**Display Font:** Fraunces (with Inter, sans-serif fallback)
**Body Font:** Inter (with sans-serif fallback)

**Character:** A warm, editorial serif for headings paired with a neutral workhorse sans. The serif gives local personality; the sans keeps directory data legible.

### Hierarchy
- **Display** (700, large hero sizes, 1.25 line-height, -0.025em): Page and hero headlines.
- **Headline** (700, 1.5rem, 1.25, -0.02em): Section headings; h1 in prose is 1.875rem, h3 1.25rem.
- **Body** (400, 1.0625rem prose / 0.875-1rem UI, 1.7): Articles and descriptions; keep prose near 65-75ch.
- **Label** (500, 0.875rem): Form labels and small UI text.

### Named Rules
**The Serif-Heads Rule.** All h1-h6 use Fraunces; all other text uses Inter. Never set body copy in the serif.

## Layout

Mobile-first. The `container-max` wrapper centers content at 80rem with 1rem side padding, growing to 1.5rem at 640px and 2rem at 1024px. Sections use 4rem top and 5rem bottom padding. Grids collapse from multi-column to a single column on phones (category grids 2-col mobile, business cards 1-col mobile). The header is sticky at 4rem tall with grouped dropdowns (Explore, Stories, Homes, About, Services) that collapse into a mobile menu.

## Elevation & Depth

A hybrid: cards rest almost flat (hairline shadow plus a pale border) and gain depth on interaction. Primary and accent buttons carry colored ambient shadows tinted to their hue. Glass panels and teal/coral glows appear on dark bands.

### Shadow Vocabulary
- **Card rest** (`box-shadow: 0 1px 3px rgba(0,0,0,0.05)`): Default card state.
- **Card lift** (`box-shadow: 0 12px 32px rgba(0,0,0,0.1)` with `translateY(-4px)`): Card hover.
- **Primary glow** (`0 4px 14px rgba(0,122,127,0.25)`, hover `0 8px 24px rgba(0,122,127,0.35)`): Teal buttons.
- **Accent glow** (`0 4px 14px rgba(232,93,74,0.25)`, hover `0 8px 24px rgba(232,93,74,0.35)`): Coral buttons.
- **Focus ring** (`0 0 0 3px rgba(0,168,168,0.4)`): Button focus; inputs use 0.2 alpha.

### Named Rules
**The Lift-Not-Scale Rule.** Hover raises elements with translateY and shadow; it never scales them, which shimmers text.

## Shapes

Friendly and rounded. Buttons and inputs use 0.75rem (12px); cards use 1rem (16px); prose images 0.75rem; code blocks and small chips 0.25-0.5rem. Featured cards add a 2px coral border. Ordinary cards use a 1px pale slate border.

## Components

### Buttons
- **Shape:** Soft rounded rectangle (12px), 0.75rem 1.5rem padding, 600 weight, icon + label with 0.5rem gap.
- **Primary:** Teal-to-deep-teal 135deg gradient, white text, teal glow.
- **Hover / Focus:** Rises 2px, glow deepens, brightness 1.08; focus shows a 3px translucent teal ring.
- **Accent:** Same construction in coral.
- **Outline:** 2px teal border, teal text; fills with the teal gradient on hover.
- Transitions run 200ms ease-out.

### Cards / Containers
- **Corner Style:** 1rem.
- **Background:** Paper White on Cool Mist.
- **Shadow Strategy:** See Elevation; lift 4px on hover.
- **Border:** 1px pale slate (#f1f5f9); featured variant uses 2px coral.

### Inputs / Fields
- **Style:** Full width, 0.875rem/1rem padding, 12px radius, 1px slate-200 border, white fill, 0.875rem text, slate-400 placeholder.
- **Focus:** Border turns teal with a 3px 20% teal halo.

### Navigation
- Sticky white header, 4rem tall, hairline bottom border and light shadow, logo left. Grouped dropdowns with leading Lucide icons; collapses to a hamburger menu on mobile.

### Backgrounds
- **Mesh:** Soft teal, coral and gold radial blooms on Cool Mist.
- **Midnight band:** Vertical gradient from #061f2e to #0b3a52 for heroes and campaigns.
- **Glass:** Translucent blurred panels over dark bands.

## Do's and Don'ts

### Do:
- **Do** use Fraunces for every heading and Inter for everything else.
- **Do** keep teal as the default interactive color and reserve coral for featured items and the primary conversion.
- **Do** lift cards and buttons with translateY and shadow on hover.
- **Do** use Lucide icons for UI glyphs.
- **Do** use the shared tokens (`--color-*`, `.btn-*`, `.card`, `.input`) before inventing new ones.

### Don't:
- **Don't** scale elements on hover.
- **Don't** use a coloured left-border stripe on callouts or quotes; use a tinted panel.
- **Don't** put body copy in the serif.
- **Don't** use coral or gold as large background fills on content pages.
- **Don't** introduce a second accent hue beyond coral and gold.
- **Don't** hard-code new hex values in components when a token exists.
