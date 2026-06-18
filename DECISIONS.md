# DECISIONS.md — locked architectural choices

> Per AGENTS.md, this file is **frozen** — agents may not edit it without explicit owner approval.

This document records decisions that have already been made for `personal-os` so that contributors (human or AI) don't relitigate them. Add new decisions only via PR with the owner's sign-off.

## Identity

- **Owner:** Chirag Singhal (`whyiswhen@gmail.com`)
- **Public site:** [chirag127.in](https://chirag127.in)
- **Sunsetting alias:** `chirag127.in` (formerly `chirag127.github.io`); see `src/middleware/redirect-chirag127in.ts` once implemented

## Stack — locked

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Astro 6 + React 19 islands | Static-first; React only where interactivity is needed |
| Styling | Tailwind v4 (`@tailwindcss/vite`) | CSS variables defined in `src/styles/tokens.css` |
| Lint/format | Biome 2 | Zero warnings; one pattern per concern |
| Tests (unit) | Vitest 4 + Testing Library | Co-located `*.test.ts` + central `tests/unit/` |
| Tests (e2e) | Playwright | Three device profiles (chromium-desktop, firefox-desktop, webkit-mobile) |
| Hosting | Cloudflare Pages | Free tier only |
| Auth + DB | Firebase (Spark plan) | Auth + Firestore; no paid tier |
| AI runtime | Puter.js | Client-side only; no API keys shipped |
| Validation | Zod | Schemas in `src/lib/schemas/` |

## Hard constraints

- **No paid services.** Everything must work on free tiers.
- **No API keys shipped to the client** for the AI twin — Puter.js owns that.
- **`content/` is the single source of truth — _aspirational, not enforced_.** Per owner directive 2026-06-19 (see [`docs/QUESTIONS.md`](./docs/QUESTIONS.md#q1) Q1), the existing `src/data/*.ts` layer and inline page constants stay where they are; do not migrate to `content/`. Shared identifiers (usernames, endpoints) still read from `src/lib/config.ts` — that part is enforced. The `content/` directory remains the target shape for future greenfield collections (résumé, blog, journal) but is not a prerequisite for landing changes elsewhere.
- **No `console.log`** in production code. Use the logger at `src/lib/log.ts` (no-ops in prod). Existing 98 call sites migrate lazily when their file is next touched (Q3 in `docs/QUESTIONS.md`).
- **Strict TypeScript.** No new `any` without `// TODO(<gh-issue>): drop any` plus an explanation. Existing 217 `any` annotations migrate lazily when their file is next touched (Q2 in `docs/QUESTIONS.md`).
- **Conventional commits.** One concern per commit; never `git push` or open PRs without explicit instruction.

## Owner directives — log

Time-stamped overrides of the otherwise-canonical AGENTS.md rules. New entries append; existing entries are not edited.

- **2026-06-19 — Q1:** keep `src/data/*.ts`; do not migrate to `content/`. AGENTS.md "single source of truth = content/" is downgraded to aspirational.
- **2026-06-19 — Q2:** lazy migration of 217 existing `any` annotations; no mass rewrite.
- **2026-06-19 — Q3:** lazy migration of 98 existing `console.*` calls; no mass rewrite.

## Open / pending decisions

Tracked in [`docs/QUESTIONS.md`](./docs/QUESTIONS.md). When a question there gets answered, move the resolution into this file and close the entry there.
