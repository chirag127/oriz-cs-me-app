---
type: architecture
title: Theme system — 4 themes × 7 accents, FOUC-proof
description: How [data-theme] and [data-accent] swap the entire palette without flicker.
resource: src/styles/tokens.css
tags: [architecture, theme, design-tokens, css]
timestamp: 2026-06-19T00:00:00Z
---

# Theme system

Four themes (dark, light, AMOLED, contrast) crossed with seven accents
(teal default + cyan, violet, emerald, amber, rose, sky) drive the entire
palette via CSS variables on `<html data-theme data-accent>`.

The token system is **architecturally sound**; the failure mode is **adoption** —
many pages bypass tokens and use raw Tailwind utility colors. See
[`sources/design-audit.md`](../sources/design-audit.md) for the gap and
[`decisions/accent-token-policy.md`](../decisions/accent-token-policy.md) for what
should be accent-aware vs decorative.

## Mechanics

1. **Raw palette** lives in `src/styles/tokens.css` under `:root` —
   neutral grays, teal, violet, rose, emerald, amber, sky.
2. **Semantic tokens** reference raw values: `--surface-base`, `--text-primary`,
   `--primary` (the accent), `--shadow-glow-teal` (semantic name despite "teal" — the
   value swaps with the accent), and so on.
3. **Theme override blocks** (`:root[data-theme='light']`, `[data-theme='amoled']`,
   `[data-theme='contrast']`) override the surface and text tokens.
4. **Accent override blocks** (`:root[data-accent='cyan']`, etc.) override
   `--primary*` tokens. The bare `:root` block is the default (teal).

## FOUC paint

`Layout.astro` includes an inline script that runs before first paint:

- Reads `localStorage.theme` and sets `<html data-theme>` accordingly (default `dark`).
- Reads `localStorage.accent` and sets `<html data-accent>` accordingly (default unset = teal).
- Persists user choice on theme/accent dropdown change.

Confirmed working — see `Layout.astro` lines ~132–157
(per [`sources/design-audit.md`](../sources/design-audit.md)).

## Where the dropdowns live

The mega header — see [`components/mega-header.md`](../components/mega-header.md) —
hosts the 4 theme icons and 7 accent dots. Click switches the attribute on `<html>`
and writes localStorage.

## Token reference (excerpt)

| Token | Purpose |
| --- | --- |
| `--primary`, `--primary-light`, `--primary-dark`, `--primary-muted`, `--primary-faint` | Accent variants |
| `--surface-base`, `-raised`, `-elevated`, `-overlay`, `-card`, `-card-hover`, `-sidebar` | Backgrounds |
| `--text-primary`, `-secondary`, `-tertiary`, `-muted`, `-faint` | Text levels |
| `--border-subtle`, `-default`, `-hover`, `-active`, `-focus` | Borders |
| `--shadow-glow-teal` | Accent glow (semantic — value swaps with accent) |

## Adoption status

Per the design audit:

- ✓ `Layout.astro`, `Sidebar.astro`, `AuthBanner`, `AuthWidget`, `index.astro`,
  `ChatWrapper`, `CommandPalette` — accent-aware via tokens.
- ✗ 56 of 57 pages still use `(teal|violet|emerald|amber|rose|sky|cyan)-\d{3}` Tailwind
  utilities directly. Switching the accent does NOT repaint these.
- ✗ 28 instances of the inline "section badge" pattern with hardcoded teal classes.

The fix is mechanical (Tailwind utility → token CSS var). It's tracked in
Phase 1 of [`sources/rebuild-plan.md`](../sources/rebuild-plan.md).

## See also

- [`overview.md`](overview.md)
- [`components/mega-header.md`](../components/mega-header.md)
- [`decisions/accent-token-policy.md`](../decisions/accent-token-policy.md)
- [`sources/design-audit.md`](../sources/design-audit.md)
