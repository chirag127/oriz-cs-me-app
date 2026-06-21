---
type: component
title: Sidebar — 3-level nav with emojis
description: Left-rail navigation. 3 levels deep, every page surfaced. Mobile drawer.
resource: src/components/Sidebar.astro
tags: [component, navigation, sidebar]
timestamp: 2026-06-19T00:00:00Z
---

# Sidebar

The left-rail navigation. Astro component (no React island needed — pure
markup + a tiny script for the mobile drawer toggle). Renders **every page** on
the site — 3 levels deep, with section emojis injected per the recent
"3-level sidebar covering every existing page" commit.

## Structure

```
Section (emoji + name)
  └─ Subsection
        └─ Page link
```

- Top level: `Index`, `Me`, `Work`, `Code`, `Library`, `Gaming`, `Connect`,
  `System`, `Legal`.
- Second level: groupings inside a section (e.g. `Library → Movies`,
  `Library → Anime`, `Library → Music`).
- Third level: individual pages (e.g. `Library → Movies → Watched`).

## Active state

The current page's link gets the `--primary` accent text and a left-edge bar
in `--primary`. Parent rows of the active page expand by default.

## Mobile

Below the lg breakpoint the sidebar collapses to a drawer. A button in the
[`mega-header.md`](mega-header.md) toggles it. Backdrop click + Escape both close.

## Accent token consumption

Sidebar already reads from `--primary` and `--surface-sidebar`. Switching the
accent dot in the header repaints the active-link bar and hover states without
a reload. (Most page-level UI does NOT yet consume tokens — see
[`sources/design-audit.md`](../sources/design-audit.md).)

## Inventory

The sidebar's own list is the canonical inventory of routes — 57 pages per
[`architecture/overview.md`](../architecture/overview.md). When a new page is
added the sidebar must be updated; it is the authoritative menu.

## See also

- [`mega-header.md`](mega-header.md)
- [`architecture/themes.md`](../architecture/themes.md)
- [`runbooks/add-new-tracker-page.md`](../runbooks/add-new-tracker-page.md)
