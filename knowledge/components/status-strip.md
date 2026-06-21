---
type: component
title: StatusStrip — homepage live data widget
description: Discord presence + now-playing + weather, single-strip on the homepage. Cached 60s via /api/now.
tags: [component, homepage, status, live]
timestamp: 2026-06-19T00:00:00Z
---

# StatusStrip

Homepage widget that surfaces live signals about Chirag in a single thin strip:

- **Discord presence** via Lanyard public API (no auth).
- **Now-playing track** via the existing ListenBrainz endpoint.
- **Weather** at Chirag's location via Open-Meteo (no auth, lat/lon from
  `src/lib/config.ts`).

## Backed by /api/now

A single Cloudflare Pages Function `/api/now` consolidates the three calls and
caches the response 60 s. The frontend hits one endpoint instead of three.

This is **Phase 2** in [`sources/rebuild-plan.md`](../sources/rebuild-plan.md);
some pieces may not yet be wired at the time of reading. The function lives
under `functions/api/now.ts`.

## Layout

```
[ 🟢 Online · Coding in VS Code ] [ ♪ Track — Artist ] [ ☀ 28 °C · Mumbai ]
```

A single horizontal strip; collapses to a card on narrow viewports.

## Empty / fallback

Uses [`empty-state.md`](empty-state.md) per-cell when one of the three sources
errors — the other two still render. Net: the strip degrades gracefully even
if Discord rate-limits or Open-Meteo blips.

## Open question

> Should each cell link to a per-source detail page, or stay decorative?

Tracked in [`sources/rebuild-plan.md`](../sources/rebuild-plan.md) "Open
questions for next session".

## See also

- [`architecture/data-flow.md`](../architecture/data-flow.md)
- [`sources/rebuild-plan.md`](../sources/rebuild-plan.md)
- [`empty-state.md`](empty-state.md)
