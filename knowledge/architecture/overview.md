---
type: architecture
title: Stack overview — me.oriz.in
description: Top-level tech stack, hosting, and the role of each major dependency.
resource: README.md
tags: [architecture, stack, overview]
timestamp: 2026-06-19T00:00:00Z
---

# Stack overview

me.oriz.in is Chirag Singhal's personal digital identity site — homepage, work
history, library trackers, social links, and an in-page AI chat that answers
questions about Chirag.

## What it is

A statically-generated Astro site with a small set of React islands for
interactivity (auth widget, AI chat, command palette). Data is split between
*authored* JSON (manual content like resume, projects) and *generated* JSON
(API-fetched stats like recent listens, GitHub repos, watched movies).

See [`data-flow.md`](data-flow.md) for how data moves; see
[`auth.md`](auth.md) for sign-in; see [`themes.md`](themes.md) for the look.

## Tech stack (from package.json)

| Concern | Choice | Version | Notes |
| --- | --- | --- | --- |
| Framework | Astro | ^6.1.0 | Islands architecture |
| UI islands | React | ^19.2.4 | Only on interactive components |
| Styling | Tailwind CSS | ^4.2.2 | Plus design tokens in `src/styles/tokens.css` |
| State | Zustand | ^5.0.12 | Auth store, UI store |
| DB + Auth | Firebase | ^12.11.0 | Firestore + Auth; see [`integrations/firestore.md`](../integrations/firestore.md) |
| AI | Puter.js | ^2.2.14 | No API key; see [`integrations/puter-js.md`](../integrations/puter-js.md) |
| Email | EmailJS | ^4.4.1 | Contact form alerts |
| Search index | MiniSearch | ^7.2.0 | Client-side |
| Animation | Framer Motion | ^12.38.0 | |
| Validation | Zod / Ajv | ^4.3.6 / ^8.20.0 | Ajv used in `scripts/validate-content.ts` |
| Package manager | pnpm | 11.7.0 | Pinned via `packageManager` field |
| Node | >=22.12.0 | | |

## Hosting

- **Cloudflare Pages**, project name `chirag127`. Output dir `dist`. See
  [`runbooks/deploy.md`](../runbooks/deploy.md).
- An R2 bucket `chirag-media-posters` is bound for poster images (binding
  `POSTERS`). `wrangler.toml` is the source of truth.
- Headers config in `wrangler.toml`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, immutable cache for `/_astro/*`.

## Top-level routes

57 routes organized by section (per [`sources/design-audit.md`](../sources/design-audit.md)):

| Section | Pages | Purpose |
| --- | --- | --- |
| `/` | 1 | Homepage — hero, stats, projects, skills |
| `/me` | 7 | Personal — story, philosophy, gear, finance |
| `/work` | 6 | Career — timeline, skills, projects, education, certs |
| `/code` | 5 | GitHub, npm, Stack Overflow, Holopin |
| `/library` | 18 | Movies, TV, anime, books, music, manga, podcasts |
| `/connect` | 17 | Social profiles, contact form |
| `/gaming` | 1 | Chess (Lichess), Steam |
| `/system` | 3 | Settings, changelog, admin |
| `/legal + 404` | 5 | Privacy, terms, disclaimer, cookie policy |

## Build pipeline

`pnpm run build` runs:
1. `prebuild` — `tsx scripts/mirror-content.ts` then `tsx scripts/generate-og-images.ts`
2. `astro build` — produces `dist/`

See [`data-flow.md`](data-flow.md) for what `mirror-content` does.

## CI workflows (.github/workflows/)

- `daily-build.yml` — lint + test + e2e + deploy
- `sync-firestore.yml` — every 6 h: fetch APIs → quality-gate → Firestore
- `snapshot-weekly.yml` — Mondays: commit Firestore snapshot to repo
- `build-resume.yml` — RenderCV → GitHub Release; see [`integrations/render-cv.md`](../integrations/render-cv.md)
- `refresh-models.yml` — daily: refresh OpenRouter `:free` model catalog; see [`integrations/open-router.md`](../integrations/open-router.md)

## See also

- [`data-flow.md`](data-flow.md), [`auth.md`](auth.md), [`themes.md`](themes.md)
- [`sources/rebuild-plan.md`](../sources/rebuild-plan.md)
