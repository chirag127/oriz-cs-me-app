---
type: source-of-truth
title: Pointer — docs/DESIGN-AUDIT.md
description: Phase 1 design audit. Identifies the token-adoption gap that drives Phase 1 fixes.
resource: docs/DESIGN-AUDIT.md
tags: [source, design, audit, tokens]
timestamp: 2026-06-19T00:00:00Z
---

# Source of truth: docs/DESIGN-AUDIT.md

Full audit at [`docs/DESIGN-AUDIT.md`](../../docs/DESIGN-AUDIT.md).

## TL;DR

The token system is **architecturally sound** — tokens, themes, spacing,
typography all defined in `src/styles/tokens.css`. The failure is **adoption**:
56 of 57 pages bypass tokens and use raw Tailwind utility colors. Bridging that
gap is the highest-leverage thing this session.

## Inventory (57 routes)

| Section | Pages |
| --- | --- |
| Index | 1 |
| Work | 6 |
| Library | 18 |
| Me | 7 |
| Connect | 17 |
| Code | 5 |
| Gaming | 1 |
| System | 3 |
| Legal/404 | 5 |

## Cross-cutting findings

1. **Hardcoded Tailwind colors on every page.** `(teal|violet|emerald|amber|rose|sky|cyan)-\d{3}`
   patterns appear on 56 of 57 pages. The accent dropdown only repaints
   components that use `var(--primary)`.
2. **One unabstracted "section badge" repeats 28 times.** Every section index
   page hand-rolls the same badge — fixing it as a component flips 28 surfaces
   accent-aware. This is what [`components/page-header.md`](../components/page-header.md) is for.
3. **Cards partially abstracted.** Glass card OK; stat card / link card not abstracted.
4. **Empty/fallback states inconsistent.** `/library/*` use hardcoded inline
   gradient sets; `/code/*` and `/connect/*` go blank. Only `/code/repos` had a
   friendly empty state. [`components/empty-state.md`](../components/empty-state.md) generalizes.
5. **Hero gradients duplicated as inline styles.** Hardcoded teal RGBA — won't
   follow accent.

## Component reuse opportunities

| Component | Surfaces | Effort | Priority |
| --- | --- | --- | --- |
| `<PageHeader>` | 30+ pages | Low | **Critical** |
| `<StatCard>` | 8 pages, ~60 instances | Low | High |
| `<EmptyState>` | 20+ pages | Medium | High |
| `<LinkCard>` | 15+ instances | Medium | Medium |
| `<HeroGlow>` | 6+ pages | Low | Medium |
| Fallback gradient module | 8 pages | Medium | Low |

## Phase 1 fixes (this session)

| # | Fix | Effort |
| --- | --- | --- |
| 1 | Mega header (theme + accent + AI/GitHub/Resume/Avatar) | High — done/in flight |
| 2 | Sidebar emoji injection | Low — done |
| 3 | Accent token sweep | Medium — partial |
| 4 | PageHeader + adopt on 8 section landings | Low–Med |
| 5 | EmptyState + adopt on /library/*, /code/* | Medium |

## Token reference (under-used)

- Primary accent: `var(--primary)` + variants `--primary-light/-lighter/-dark/-darker/-faint/-muted/-subtle`.
- Glow: `--shadow-glow-teal` (semantic — value swaps with accent).
- Text: `--text-primary` … `--text-faint` (5 levels).
- Surfaces: `--surface-base/-raised/-elevated/-overlay/-card/-card-hover/-sidebar`.
- Borders: `--border-subtle/-default/-hover/-active/-focus`.

## See also

- [`rebuild-plan.md`](rebuild-plan.md)
- [`../architecture/themes.md`](../architecture/themes.md)
- [`../decisions/accent-token-policy.md`](../decisions/accent-token-policy.md)
- [`../components/page-header.md`](../components/page-header.md)
- [`../components/empty-state.md`](../components/empty-state.md)
