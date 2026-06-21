---
type: decision
title: "Age-gating policy for me.oriz.in"
description: "When and how content sections require 18+ confirmation before rendering. Implements §6 of the 100-year strategy."
tags: [decision, privacy, age-gate, compliance]
timestamp: 2026-06-19
---

# Age-gating policy for me.oriz.in

> Status: **active contract**, decided 2026-06-19. Implements
> [`100-year-strategy.md`](./100-year-strategy.md) §6.
> Re-read annually on each birthday alongside the parent strategy doc.

## What is age-gated

A page or section MUST go behind the 18+ gate when it surfaces:

- **Movies / TV episodes** with an upstream rating of `18`, `R18+`, `NC-17`,
  `X`, `Adults Only`, or any equivalent national classification meaning
  "restricted to adults" (TMDB / Letterboxd / Trakt source ratings).
- **Anime / manga** flagged `Rx` (hentai) on AniList/MAL, or carrying
  AniList's `is_adult` boolean true. Manga flagged `pornographic` on
  MangaDex.
- **Visual novels** with adult-content flags on VNDB (`erotic`, `explicit
  sexual content`, `violence (extreme)`).
- **Manual log entries** Chirag explicitly flags as 18+ via the manual-log
  form. The default for a manual log is `public` — adult flagging is opt-in
  and per-entry.

The visibility tier `age-gated-18` (see
`src/lib/lifestream/types.ts → EventVisibility`) is the single source of
truth. The presence of this tier on any row pulled into a page forces the
whole page to render behind the gate.

## What is NOT age-gated

- **R-rated movies** (US R, UK 15, IN A) — `R` is not 18+ in most
  jurisdictions and the rating MPA assigns is much broader than the legal
  adults-only threshold. Render publicly.
- **Standard horror / thriller / war content** — graphic violence alone
  does not trigger the gate.
- **Profanity-heavy works** (rap albums, comedy specials) — language alone
  does not trigger the gate.
- **Hard mental-health discussion** — depression, suicidal ideation,
  trauma. These belong on the public site without a gate; they need
  framing (see strategy §7), not a confirmation prompt.
- **Political content** — political opinion is public-by-default per the
  strategy doc.

The gate exists only for content that is plausibly **legally restricted**
to adults in any major audience jurisdiction. It is not a "this might be
intense" warning.

## Mechanism

A single React island, `<AgeGate>`
([`src/components/islands/AgeGate.tsx`](../../src/components/islands/AgeGate.tsx)),
wraps any age-gated page or page section. Behaviour:

- On mount, reads cookie `oriz-me:age-gate-18`.
- If the cookie value matches `accepted-YYYY-MM-DD` AND that date is
  within the last 365 days, the gated children render.
- Otherwise the gate UI renders: a centered card with the section label,
  an "I'm 18 or older" button, and an "I'm not 18, take me back" link
  pointing at the parent index (default `/library/`).
- On accept, the cookie is written as `accepted-2026-MM-DD` (today's ISO
  date) with `Max-Age=365d`, `SameSite=Lax`, `Secure`, `Path=/`. The
  literal-date payload is intentional — a yearly review can re-prompt
  visitors after a year by simply allowing the cookie to expire.
- The site **never asks for date-of-birth**. A single binary
  attestation is all jurisdictional law actually requires for
  non-pornographic content classification, and DOB collection would
  trigger a far larger compliance surface (children's data, consent age
  thresholds, retention rules).

## Listing pages, not just detail pages

If a listing page (e.g. `/library/movies-watched`) contains any
age-gated entries, the gate guards **the listing**, not just the
individual detail pages. Otherwise poster/cover thumbnails leak adult
content before the gate can intervene. The implementation is: any page
that *might* render an `age-gated-18` row uses `AgeGatedLayout`, even if
today's data has zero such rows.

## Server-side reinforcement

Pages rendered with `AgeGatedLayout` carry:

- `<meta name="rating" content="adult">` — RTA / SafeSurf legacy hint.
- `<meta name="robots" content="noindex">` — keeps the page out of
  search-engine results so link previews and crawl snippets cannot leak
  content. Sitemaps must omit gated routes.
- `<body data-oriz-age-gate="required">` — chrome and analytics can
  detect a gated page without inspecting URL patterns. Matches the
  `[data-oriz-*]` attribute namespace from the v2 design system.

The gated children are mounted via `client:only="react"`, so the SSR
output for a non-attested visitor contains only the gate prompt — never
the gated body content.

## Annual jurisdictional review

The legal landscape moves: **UK Online Safety Act**, **EU DSA**, **India
IT Rules 2021**, **Australia eSafety Act**. Each year on Chirag's
birthday, re-read those regulations and update this policy. The annual
checklist in `100-year-strategy.md` includes a line-item for this review.

## Cross-references

- Parent strategy: [`100-year-strategy.md`](./100-year-strategy.md) §6
  defines the public/age-gated/aggregates-only/private tiers.
- Visibility type: `src/lib/lifestream/types.ts → EventVisibility` —
  the `age-gated-18` value is the source of truth.
- Implementation: `src/components/islands/AgeGate.tsx` (island) and
  `src/layouts/AgeGatedLayout.astro` (wrapper layout).
