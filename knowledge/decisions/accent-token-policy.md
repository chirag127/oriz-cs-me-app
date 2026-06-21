---
type: decision
title: Accent token policy — touch-points only, decorative left alone
description: Accent (--primary) repaints links/buttons/focus/active-nav/badges. Leaf-page decorative colors stay per-card.
tags: [decision, design, theme, accent]
timestamp: 2026-06-19T00:00:00Z
---

# Decision: Accent token policy — touch-points, not decoration

## Status

Locked.

## Context

The accent dropdown in [`components/mega-header.md`](../components/mega-header.md)
swaps `--primary` between teal / cyan / violet / emerald / amber / rose / sky.
The naive policy would be "make every accent-colored thing on the site swap
with the dropdown." That breaks two things:

- Library pages have intentionally varied per-card gradients (each book/movie
  card has its own accent gradient as decoration). Forcing them all to swap
  with one dropdown destroys visual identity.
- Per-section emojis and category badges that pair with specific colors
  (e.g. red for warnings, green for success) MUST not move.

## Decision

`--primary` (and its `--primary-*` variants) repaint **touch-points only**:

| Surface | Accent-aware? | Why |
| --- | --- | --- |
| Links (in body text) | ✓ | Matches the user's accent choice |
| Buttons (primary action) | ✓ | Same |
| Focus rings | ✓ | Same |
| Active sidebar/header item | ✓ | Same |
| Section badges (eyebrow pill at the top of section pages) | ✓ | Same |
| Hero glow backdrop | ✓ | Sets ambient mood |
| Status pulse dot in [`components/status-strip.md`](../components/status-strip.md) | ✓ | Touch-point analogue |
| Per-card decorative gradients on `/library/*` | ✗ | Each card keeps its identity |
| Semantic color (success green, warning amber, error rose) | ✗ | Meaning, not theme |
| Brand logos / external service colors (GitHub black, Bluesky blue) | ✗ | Truth, not theme |

## Why this matters

The design audit (see [`sources/design-audit.md`](../sources/design-audit.md))
found 56 of 57 pages using raw Tailwind utility colors instead of tokens. The
fix is not "swap everything to `--primary`" — it's "swap **touch-points** to
`--primary` and leave **decoration** alone." This decision draws the line.

## Consequences

- The accent dropdown changes ~30% of visible color, not 100%. Intentional.
- New components must explicitly choose: am I a touch-point (use `--primary*`)
  or am I decorative (use a semantic or per-instance color)?

## See also

- [`architecture/themes.md`](../architecture/themes.md)
- [`sources/design-audit.md`](../sources/design-audit.md)
- [`components/page-header.md`](../components/page-header.md) — uses --primary
