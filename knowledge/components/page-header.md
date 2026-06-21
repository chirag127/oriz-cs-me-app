---
type: component
title: PageHeader — reusable section hero
description: Badge + h1 + description + optional emoji. Replaces 30+ hand-rolled hero strips.
tags: [component, layout, hero]
timestamp: 2026-06-19T00:00:00Z
---

# PageHeader

The reusable hero strip at the top of section landing pages. Displaces the
hand-rolled "section badge + h1 + description" pattern that the design audit
counted on 30+ pages with hardcoded teal classes.

## Anatomy

```
[ ● SECTION NAME ]            ← status badge with pulse dot, accent-tinted
H1: Section title
description: short paragraph
optional: emoji decoration / hero glow backdrop
```

## Why it exists

Per [`sources/design-audit.md`](../sources/design-audit.md), 28 hand-rolled
section badges all use hardcoded `bg-teal-500/5 border-teal-500/15 text-teal-400`.
Replacing them with one component flips 28 surfaces to accent-aware. This is
the single highest-leverage refactor in Phase 1.

## Props

- `eyebrow: string` — short uppercase label rendered inside the badge (e.g. `LIBRARY`).
- `title: string` — h1 text.
- `description?: string` — paragraph below.
- `emoji?: string` — optional emoji rendered next to the title.

## Token usage

- Badge background: `var(--primary-faint)` — 5–8% accent tint.
- Badge border: `var(--primary-muted)` — 15% accent.
- Badge text + dot: `var(--primary-light)`.
- h1 text: `var(--text-primary)`.
- Description: `var(--text-tertiary)`.

All swap with the accent dot.

## Adoption status

Phase 1 fix #4 in [`sources/rebuild-plan.md`](../sources/rebuild-plan.md). Adopted
on N section landings; full migration is mechanical.

## See also

- [`empty-state.md`](empty-state.md) — pairs naturally on tracker pages
- [`architecture/themes.md`](../architecture/themes.md)
- [`decisions/accent-token-policy.md`](../decisions/accent-token-policy.md)
