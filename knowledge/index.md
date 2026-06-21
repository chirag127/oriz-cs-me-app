---
type: index
title: "Per-site knowledge — me.oriz.in"
description: "Site-specific concept pages for me.oriz.in (lifestream, age-gating, ingester contract, components, integrations). Family-wide rules live one level up."
tags: [okf, index, oriz-me]
timestamp: 2026-06-20
format_version: okf-v0.1
status: active
---

# Per-site knowledge — me.oriz.in

Family-wide conventions and rules live in [`../../`](../../) — read [`../../_okf.md`](../../_okf.md) for the format contract and [`../../rules/index.md`](../../rules/index.md) for the 5 hard rules. This bundle only carries facts that are specific to **me.oriz.in**.

## Architecture

How the site is wired end-to-end.

- [`architecture/overview.md`](architecture/overview.md) — me.oriz.in stack, hosting, top-level data shape
- [`architecture/data-flow.md`](architecture/data-flow.md) — authored JSON → mirror → /data; fetcher → quality-gate → Firestore → snapshot
- [`architecture/auth.md`](architecture/auth.md) — Firebase Google + email/password; Puter.js separate, only AI features
- [`architecture/themes.md`](architecture/themes.md) — 4 themes × 7 accents, FOUC paint script, token system

## Components

Reusable Astro / React surfaces.

- [`components/mega-header.md`](components/mega-header.md) — sticky top bar contents
- [`components/sidebar.md`](components/sidebar.md) — 3-level nav, mobile drawer
- [`components/page-header.md`](components/page-header.md) — reusable hero strip (badge + h1 + description)
- [`components/empty-state.md`](components/empty-state.md) — friendly fallback for missing API data
- [`components/status-strip.md`](components/status-strip.md) — homepage live-data widget

## Integrations

Third-party services we depend on.

- [`integrations/firestore.md`](integrations/firestore.md) — collections, security-rule policy, public-read media/{key}
- [`integrations/puter-js.md`](integrations/puter-js.md) — AI feature gate, network constraint, no API key
- [`integrations/open-router.md`](integrations/open-router.md) — `:free` model catalog, daily refresh
- [`integrations/render-cv.md`](integrations/render-cv.md) — 3 YAML resume variants → CI publishes Releases

## Decisions

Locked architectural calls and the why.

- [`decisions/100-year-strategy.md`](decisions/100-year-strategy.md)
- [`decisions/accent-token-policy.md`](decisions/accent-token-policy.md) — accent only on touch-points
- [`decisions/age-gating-policy.md`](decisions/age-gating-policy.md)
- [`decisions/ingester-contract.md`](decisions/ingester-contract.md)
- [`decisions/why-content-folder-is-not-content-collection.md`](decisions/why-content-folder-is-not-content-collection.md)
- [`decisions/why-firestore-not-turso.md`](decisions/why-firestore-not-turso.md)

## Runbooks

Operational playbooks.

- [`runbooks/deploy.md`](runbooks/deploy.md) — `pnpm run build` + `wrangler pages deploy`
- [`runbooks/add-new-tracker-page.md`](runbooks/add-new-tracker-page.md) — new `/library/foo.astro` with EmptyState + hasData guard
- [`runbooks/refresh-firestore-data.md`](runbooks/refresh-firestore-data.md) — `workflow_dispatch sync-firestore.yml` or local `pnpm run fetch-data`

## Sources of truth

Pointers to canonical docs/research.

- [`sources/rebuild-plan.md`](sources/rebuild-plan.md)
- [`sources/design-audit.md`](sources/design-audit.md)
- [`sources/tracker-landscape-2026.md`](sources/tracker-landscape-2026.md)

## Meta

- [`log.md`](log.md) — append-only changelog for this site bundle
- [`../../_okf.md`](../../_okf.md) — family OKF convention (the contract)
- [`../../index.md`](../../index.md) — family bundle root
