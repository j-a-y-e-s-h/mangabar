---
name: MangaBar Design System
description: High-performance obsidian dark design system for MangaBar IDE extension and web showcase.
colors:
  primary: "#00e5ff"
  primary-glow: "rgba(0, 229, 255, 0.3)"
  secondary: "#a855f7"
  secondary-glow: "rgba(168, 85, 247, 0.25)"
  bg-deep: "#07090e"
  bg-surface: "#0e121b"
  card-bg: "rgba(18, 24, 38, 0.75)"
  card-border: "rgba(255, 255, 255, 0.08)"
  card-border-hover: "rgba(0, 229, 255, 0.35)"
  text-primary: "#f3f6fb"
  text-muted: "#94a3b8"
  text-dim: "#64748b"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(2.4rem, 5vw, 3.8rem)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.8rem, 3.5vw, 2.4rem)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.88rem"
    fontWeight: 500
rounded:
  sm: "8px"
  md: "14px"
  lg: "20px"
  pill: "100px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#030712"
    rounded: "{rounded.md}"
    padding: "14px 28px"
  button-secondary:
    backgroundColor: "{colors.card-bg}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "14px 28px"
---

# Design System

<!-- impeccable:design-schema 1 -->

## Overview

MangaBar employs an **Obsidian Cyber-Minimalist** aesthetic tailored for developers. It bridges IDE native chrome with an immersive, high-contrast reading environment. The palette utilizes deep space blacks (`#07090e`), layered translucent surfaces, and vibrant electric cyan (`#00e5ff`) accents to indicate interaction, focus, and state.

## Colors

The color system is organized into semantic layers:
- **Base Surfaces:**
  - Canvas Deep: `#07090e` (main backdrop)
  - Surface Raised: `#0e121b` (navigation bar, chrome headers)
  - Card Glass: `rgba(18, 24, 38, 0.75)` with `backdrop-filter: blur(16px)`
- **Accents:**
  - Primary Accent: `#00e5ff` (Electric Cyan) — actions, active states, focus rings, primary CTA.
  - Secondary Accent: `#a855f7` (Neon Violet) — secondary badges and gradient ambient lighting.
- **Borders & Dividers:**
  - Subdued Border: `rgba(255, 255, 255, 0.08)`
  - Active / Hover Border: `rgba(0, 229, 255, 0.35)`
- **Typography:**
  - Primary Text: `#f3f6fb` (High contrast, clean legibility)
  - Secondary Muted: `#94a3b8` (Subtitles, descriptions)
  - Dim Text: `#64748b` (Meta labels, secondary dividers)

## Typography

Typography relies on native system font stacks (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto`) to match developer operating systems without external font request latency.

- **Scale & Hierarchy:**
  - **Display (Hero Title):** `clamp(2.4rem, 5vw, 3.8rem)` with tight tracking (`-0.03em`) and heavy weight (800).
  - **H2 (Section Titles):** `clamp(1.8rem, 3.5vw, 2.4rem)` with `-0.02em` tracking.
  - **H3 (Card Headings):** `1.3rem`, weight 600.
  - **Lead Paragraphs:** `clamp(1.1rem, 2vw, 1.3rem)`, measure capped at `65-75ch`.
  - **Monospace Code / CLI:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas` with `font-variant-numeric: tabular-nums`.

## Layout

The layout uses fluid grid containers and strict responsive breakpoints:
- **Max Width:** `1140px` for main content, centered with automatic margins.
- **Breakpoints:**
  - **Mobile (< 640px):** Single column, 100% full-width buttons, horizontal touch scroll with snap for tabs, touch target floor >= 44x44px.
  - **Tablet (641px - 1024px):** Two-column card grid (`grid-template-columns: repeat(2, 1fr)`), adapted padding.
  - **Desktop (> 1024px):** Three-column card grid (`repeat(3, 1fr)`), side-by-side CTA groups, sticky navigation.
- **Spacing Rhythm:** Vertical section spacing maintains a consistent `4rem - 5rem` separation with compact `1.25rem` heading-to-body margins.

## Elevation & Depth

Depth is established through soft layered lighting rather than harsh drop shadows:
- **Resting Cards:** `border: 1px solid rgba(255, 255, 255, 0.08)` with soft ambient depth.
- **Card Hover:** `transform: translateY(-3px)` with `box-shadow: 0 12px 30px -10px rgba(0, 229, 255, 0.15)` and border transition to `rgba(0, 229, 255, 0.35)`.
- **Showcase Container:** `box-shadow: 0 25px 70px -12px rgba(0, 0, 0, 0.85), 0 0 35px rgba(0, 229, 255, 0.12)`.
- **Focus Rings:** `outline: 2px solid #00e5ff; outline-offset: 2px;` on all interactive `:focus-visible` elements.

## Shapes

- **Base Radius:** `14px` (`--radius`) for cards, modal panels, and CTA buttons.
- **Large Radius:** `20px` (`--radius-lg`) for main navigation shell and interactive showcase viewer.
- **Small Radius:** `8px` (`--radius-sm`) for badges, kbd tags, and inline media containers.
- **Pill Radius:** `100px` for badges, showcase tab pills, and CLI copy bar.

## Components

- **Buttons:**
  - `btn-primary`: High-contrast gradient background (`#00e5ff` to `#0099ff`), dark text (`#030712`), cyan glow.
  - `btn-secondary`: Translucent obsidian card background, 1px white border, light text.
  - Touch target size: Minimum `44px` height across all viewports.
- **CLI Bar:**
  - Inline code execution pill with prompt symbol `$`, selectable command, and one-click copy button with visual copied confirmation.
- **Showcase Viewer:**
  - Integrated tab switcher with instant screen swap, zero layout shift, and smooth fade-in.
- **Feature Cards:**
  - Card header, crisp description, and media preview container with border frame.
- **FAQ Accordion:**
  - Accessible toggle header with rotating plus icon and smooth expansion.

## Do's and Don'ts

### Do's
- Always maintain high contrast (>= 4.5:1 for body copy).
- Maintain touch target floors of 44x44px on mobile viewports.
- Use authored SVG icons in place of raw Unicode emoji glyphs for interface actions.
- Use `:focus-visible` for keyboard navigation across all interactive elements.
- Support `prefers-reduced-motion` across all transitions and animations.

### Don'ts
- Do not use low-contrast gray text on dark surfaces.
- Do not animate image scaling on card hover.
- Do not introduce horizontal layout overflow on narrow mobile screens (< 360px).
- Do not use zero-blur offset block shadows or decorative gradients on raw text.
