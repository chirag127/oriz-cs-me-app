---
type: source-of-truth
title: Pointer — docs/REBUILD-PLAN.md
description: Canonical rebuild plan with phase breakdowns. This page summarizes; the full file is the truth.
resource: docs/REBUILD-PLAN.md
tags: [source, plan, phases]
timestamp: 2026-06-19T00:00:00Z
---

# Source of truth: docs/REBUILD-PLAN.md

The full rebuild plan lives at [`docs/REBUILD-PLAN.md`](../../docs/REBUILD-PLAN.md).
This page is a one-paragraph summary per phase so agents can decide whether to
open the full doc.

## Locked decisions (excerpt)

- Stack: Astro + React + Tailwind + Zustand + Firebase + Puter.js (unchanged).
- 4 themes × 7 accents (default teal + cyan/violet/emerald/amber/rose/sky).
- Dark by default; FOUC-proof inline paint; **does not** follow OS preference.
- Auth: Firebase for Firestore writes; Puter.js separate, for AI features only.
- Data home: `src/content/{authored,generated,schemas}/` is canonical;
  `public/data/` is the runtime mirror. See
  [`decisions/why-content-folder-is-not-content-collection.md`](../decisions/why-content-folder-is-not-content-collection.md).
- Forkability: Authored personal data is JSON, validated against JSON Schemas.
- Resume hosting: RenderCV YAML → CI → GitHub Releases. See
  [`integrations/render-cv.md`](../integrations/render-cv.md).
- API surface: Static `/data/*.json` + a Pages Function `/api/*` for filtered queries (deferred).
- Models in chat: OpenRouter `:free` filter, daily refresh. See
  [`integrations/open-router.md`](../integrations/open-router.md).

## Phases

### Phase 1 — In flight

Migrate data layout, rebuild theme system, wire ⌘K + ⌘J keyboard shortcuts,
add stricter TS flags, document fetch-data prereqs.

### Phase 2 — Resume + status + contact

RenderCV YAML schema, `build-resume.yml` workflow, status strip on homepage
(see [`components/status-strip.md`](../components/status-strip.md)) backed by
`/api/now` Pages Function consolidating Lanyard + ListenBrainz + Open-Meteo
with 60 s cache, contact form via EmailJS + reCAPTCHA.

### Phase 3 — Admin + AI tooling

`/system/admin` wired to Firestore; re-enable `aiQueries` / `aiChats` /
`unknownQueries` collections; AI 22-tool registry data sources confirmed
against `src/content/generated/<key>.json`.

### Phase 4 — CI hardening

OG image generation in `daily-build.yml`; Lighthouse CI per deploy with PR
comments; visual regression baselines via existing `screenshots.spec.ts`.

### Phase 5 — Content authoring

MDX blog with Sandpack code playgrounds, Pagefind search, Mermaid diagrams.
Journal WYSIWYG editor under `/system/admin/journal/new` (admin-only),
public reads on `/me/journal`.

### Phase 6 — Onboarding & forking

`use-my-browser`-driven secrets walkthrough; fork README; `pnpm run setup-secrets`
terminal fallback. Order: Firebase → OpenRouter → Trakt → Spotify → Steam →
LastFM → ListenBrainz → AniList → WakaTime → DevTo → Bluesky → YouTube →
EmailJS → reCAPTCHA → TMDB.

## Out of scope

- Twitter/X (deprecated API).
- Self-hosted analytics (Cloudflare Analytics is enough).
- Self-hosted comments (use GitHub Discussions if needed).
- Custom search backend (Pagefind suffices).

## Open questions

- Should the homepage status strip link to per-source detail pages?
- `/api/now` cache: Workers KV vs edge cache?
- Resume PDF naming: latest-overwrite vs versioned-forever?

## See also

- [`design-audit.md`](design-audit.md)
- [`tracker-landscape-2026.md`](tracker-landscape-2026.md)
- [`../architecture/overview.md`](../architecture/overview.md)
