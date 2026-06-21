---
type: component
title: EmptyState — friendly fallback for missing API data
description: Emoji + title + message + optional CTA. Replaces silent blanks on tracker pages.
tags: [component, fallback, library]
timestamp: 2026-06-19T00:00:00Z
---

# EmptyState

Friendly fallback rendered when an API-driven page has no data — either the
quality gate rejected the latest fetch (see
[`architecture/data-flow.md`](../architecture/data-flow.md)), the API key is
missing locally, or the user is genuinely a new account with nothing tracked yet.

## Why it exists

Per [`sources/design-audit.md`](../sources/design-audit.md):

- Most `/library/*` and `/code/*` pages used to render blank when data missing.
- Only `/code/repos` had a friendly empty-state with emoji + microcopy.

This component generalizes that pattern.

## Anatomy

```
🪶                              ← large emoji (60px)
Title (h2)                      ← e.g. "No recent listens"
short message                   ← e.g. "Last.fm hasn't synced in a while."
[ optional CTA button ]         ← e.g. "Refresh now" or external link
```

## Props

- `emoji: string` — the big decorative glyph.
- `title: string` — h2 line.
- `message?: string` — subtext.
- `cta?: { label: string; href: string }` — optional action.

## Adoption pattern

On any tracker page that consumes generated JSON:

```astro
{hasData ? (
  <TrackerGrid data={data} />
) : (
  <EmptyState emoji="🎬" title="No movies yet" message="Trakt sync hasn't run." />
)}
```

The `hasData` boolean guards rendering. See
[`runbooks/add-new-tracker-page.md`](../runbooks/add-new-tracker-page.md).

## Token usage

- Title: `var(--text-primary)`.
- Message: `var(--text-tertiary)`.
- CTA button: standard `--primary` accent button (see
  [`decisions/accent-token-policy.md`](../decisions/accent-token-policy.md)).

## See also

- [`page-header.md`](page-header.md)
- [`runbooks/add-new-tracker-page.md`](../runbooks/add-new-tracker-page.md)
- [`architecture/data-flow.md`](../architecture/data-flow.md)
