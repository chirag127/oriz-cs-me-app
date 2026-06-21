---
type: component
title: MegaHeader — sticky top bar
description: Sticky site header with search, theme/accent switchers, AI/GitHub/Resume/Avatar buttons.
resource: src/components/islands/MegaHeader.tsx
tags: [component, header, navigation, theme]
timestamp: 2026-06-19T00:00:00Z
---

# MegaHeader

The sticky top bar that appears on every page via `Layout.astro`. Hosts the
search box, theme + accent switchers, and the canonical entry points to AI chat,
GitHub, the latest resume PDF, and the auth widget.

## Contents (left → right)

1. **Brand mark** — links to `/`.
2. **Search** — opens the command palette (⌘K). See keybinding wiring.
3. **Theme switcher** — 4 icon buttons (dark, light, AMOLED, contrast). Sets
   `<html data-theme>` and `localStorage.theme`. See
   [`architecture/themes.md`](../architecture/themes.md).
4. **Accent switcher** — 7 colored dots (teal, cyan, violet, emerald, amber,
   rose, sky). Sets `<html data-accent>` and `localStorage.accent`.
5. **AI chat button** — toggles the `ChatWrapper` panel; ⌘J also toggles.
6. **GitHub icon** — external link to `github.com/chirag127`.
7. **Resume button** — links to the latest GitHub Release asset; see
   [`integrations/render-cv.md`](../integrations/render-cv.md).
8. **Auth widget** — the `AuthWidget` React island. Shows avatar + dropdown
   when signed in, "Sign in" otherwise. See
   [`architecture/auth.md`](../architecture/auth.md).

## React island

`MegaHeader.tsx` is a React island (interactive bits hydrate client-side).
The Astro layout passes site metadata as props. State (theme, accent, chat
open) lives in Zustand stores under `src/lib/`.

## Keyboard

- `⌘K` / `Ctrl+K` — open command palette / search.
- `⌘J` / `Ctrl+J` — toggle AI chat panel.

Listeners are attached globally in `Layout.astro` so the shortcuts work even
when focus is elsewhere.

## Accent / theme behavior

- Selected theme icon glows with `--primary` (the accent).
- Selected accent dot has a thicker ring.
- The header itself uses `--surface-sidebar` for the background and
  `--border-subtle` for the bottom edge — both auto-swap on theme change.

## See also

- [`sidebar.md`](sidebar.md) — left nav, complementary
- [`architecture/themes.md`](../architecture/themes.md)
- [`architecture/auth.md`](../architecture/auth.md)
