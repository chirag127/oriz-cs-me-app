# Rebuild Plan — me.oriz.in

> Living document. Edit as phases complete. Reference: the `<system-reminder>`-supplied scope from 2026-06-19.

## Decisions (locked)

| Topic | Decision |
| --- | --- |
| Stack | Astro + React islands + Tailwind + Zustand + Firebase + Puter.js (unchanged) |
| Themes | 4 themes: dark / light / AMOLED / contrast — CSS variables on `<html data-theme>` |
| Accents | 6 named accents (cyan / violet / emerald / amber / rose / sky) on `<html data-accent>` |
| Dark mode | Unconditional dark by default, FOUC-proof inline paint, **does not** follow system |
| Sidebar | Already built in `src/components/Sidebar.astro` — no rebuild needed |
| Header | Already sticky in `src/layouts/Layout.astro` — extend with theme + accent dropdowns |
| AI chat | Already in `ChatWrapper.tsx` — just wire ⌘J shortcut |
| Auth | Firebase (Google + email/pass) for Firestore writes; Puter.js separate, required only for AI features. Both existing widgets stay; documented in AuthModal |
| TS strict | Add `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` |
| Biome | Keep existing pragmatic exceptions; revisit per-rule later |
| Data home | `src/content/{authored,generated,schemas}/` is canonical. `public/data/` is the runtime mirror for `/data/*.json` static API |
| Forkability | Authored personal data is JSON in `src/content/authored/`, validated against JSON Schemas in `src/content/schemas/`. Forkers replace files, run a build, ship |
| Resume hosting | RenderCV YAML in `src/content/authored/resume/`, CI compiles to PDFs, GitHub Releases stores them |
| API surface | Static `/data/*.json` mirror (free, build-time) + a Cloudflare Pages Function `/api/*` for filtered queries (deferred) |
| Secrets onboarding | Guided walkthrough via `use-my-browser` skill (when user requests it) — deferred |
| Models in chat | OpenRouter free models with `:free` suffix, fetched dynamically and sorted (already wired) |

## Phase 1 — In flight (this session)

- [ ] Write this plan
- [ ] Migrate data layout: `src/data/*.ts` → `src/content/authored/*.json` (+ schemas), `src/data/generated/` → `src/content/generated/`, update ~50 imports
- [ ] Rebuild theme system (4 themes + 6 accents, CSS variables, header dropdowns, FOUC paint, persistence)
- [ ] Wire ⌘K (command palette) + ⌘J (AI chat toggle) global keydown listeners
- [ ] Add `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`, fix resulting errors
- [ ] Document prereq for populating `src/content/generated/` (`.env.local` with API keys, then `pnpm run fetch-data`)

## Phase 2 — Resume + status + contact

- RenderCV YAML schema in `src/content/authored/resume/{full,backend,ai}.yaml`
- New workflow `.github/workflows/build-resume.yml`: runs `uvx rendercv` → uploads PDFs to a GitHub Release tagged `resume-v<sha>`
- Frontend `/work/career` links to latest release asset URL
- Homepage status strip component:
  - Discord presence via Lanyard public API (no auth)
  - Now-playing via existing ListenBrainz endpoint
  - Weather via Open-Meteo (no auth, lat/lon from `src/lib/config.ts`)
  - Single Cloudflare Pages Function `/api/now` consolidates them; cached 60 s
- Contact form: EmailJS service ID + reCAPTCHA site key wiring; `.env.example` extended

## Phase 3 — Admin + AI tooling

- `/system/admin` page wired to Firestore: page-view counter, chat-history viewer (admin emails only)
- Re-enable `aiQueries`/`aiChats`/`unknownQueries` collections from `firestore.rules`
- AI 22-tool registry data sources: confirm each tool reads from `src/content/generated/<key>.json`; backfill the missing wires
- `journalEntries`: admin-only write, public read of latest N

## Phase 4 — CI hardening

- OG image generation: `scripts/generate-og-images.ts` using `satori` + `resvg-js`, runs in `daily-build.yml`
- Lighthouse CI: `.github/workflows/lighthouse.yml` against the deployed Pages URL on each `main` deploy; PR comments with score deltas
- Visual regression baselines: enable `screenshots.spec.ts` in CI with artifact upload; refresh on `[regen-baselines]` commit message

## Phase 5 — Content authoring

- Blog: MDX with Sandpack code playgrounds, Pagefind search index built at CI, Mermaid diagram support via remark plugin
- Migrate the lone existing post; document the `src/content/blog/*.mdx` schema
- Journal: WYSIWYG editor on `/system/admin/journal/new` (admin-only), saves to `journalEntries` Firestore collection, public reads on `/me/journal`

## Phase 6 — Onboarding & forking

- `use-my-browser`-driven secrets walkthrough script: opens each provider's dashboard in your live browser, prompts you to copy the key, writes it to `.env.local`. Order: Firebase → OpenRouter → Trakt → Spotify → Steam → LastFM → ListenBrainz → AniList → WakaTime → DevTo → Bluesky → YouTube → EmailJS → reCAPTCHA → TMDB
- Fork README: replace `src/content/authored/*.json`, set 14 env vars, push, deploy
- `pnpm run setup-secrets`: terminal-based fallback for the same flow without browser

## Out of scope / not doing

- Twitter/X integration (deprecated API, not worth the effort)
- Self-hosted analytics (Cloudflare Analytics is free + private enough)
- Self-hosted comments (use GitHub Discussions if needed)
- Custom search backend (Pagefind static index suffices)

## Open questions for next session

- Should the homepage status strip link to per-source detail pages, or stay decorative?
- Should `/api/now` use Workers KV for caching, or rely on Cloudflare's edge cache?
- Resume PDF naming convention on Releases: `resume.pdf` (always overwrite latest) or `resume-<variant>-v<sha>.pdf` (versioned forever)?

## Reference

- Ground-truth audit (Phase 0, 2026-06-19): see `docs/AUDIT-2026-06-19.md` (TODO: copy from chat history if needed)
- Firestore rules: `firestore.rules` — `media/{categoryId}` is the only public-read collection; user-scoped collections require auth
- Daily build: `.github/workflows/daily-build.yml` (lint + test + e2e + deploy, fetch-data is a no-op)
- Firestore sync: `.github/workflows/sync-firestore.yml` (every 6 h, validated via `scripts/lib/quality-gate.ts`)
- Weekly snapshot: `.github/workflows/snapshot-weekly.yml` (Mondays, commits Firestore → repo)
