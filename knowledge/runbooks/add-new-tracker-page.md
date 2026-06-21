---
type: runbook
title: Add a new tracker page
description: Steps to create a new /library/foo.astro tracker that consumes generated JSON safely.
tags: [runbook, library, tracker, page]
timestamp: 2026-06-19T00:00:00Z
---

# Runbook: Add a new tracker page

A "tracker" page is one that visualizes data fetched from an external API and
mirrored to `src/content/generated/<key>.json`. Examples: movies-watched,
books-read, music-top-tracks.

## Steps

### 1. Decide the data shape

If you're consuming an existing key under `src/content/generated/`, jump to
step 3. If a new API is involved:

1. Add a fetcher section to `scripts/fetch-data.ts` (or split into a sub-file
   if it's large).
2. Wrap the write with `commitSection('<key>', newData)` from
   [`scripts/lib/quality-gate.ts`](../../scripts/lib/quality-gate.ts) so the
   shrink-detection guards apply. See
   [`architecture/data-flow.md`](../architecture/data-flow.md).
3. If the section has tracked arrays, add the dot-paths to
   `ARRAY_PATHS['<key>']` in `quality-gate.ts`.
4. Add the env var(s) to `.env.example` with comments on how to obtain.
5. Confirm `mirror-content.ts` will copy `src/content/generated/<key>.json`
   to `public/data/<key>.json` (it scans the dir automatically).

### 2. Add a JSON Schema

`src/content/schemas/<key>.schema.json` — minimal but real. Validates via
`scripts/validate-content.ts`.

### 3. Create the Astro page

`src/pages/library/foo.astro` (or `/code/foo.astro`, or wherever it belongs):

```astro
---
import Layout from '../../layouts/Layout.astro';
import PageHeader from '../../components/PageHeader.astro';
import EmptyState from '../../components/EmptyState.astro';
import data from '../../content/generated/foo.json';

const items = data?.items ?? [];
const hasData = items.length > 0;
---

<Layout title="Foo tracker">
  <PageHeader eyebrow="LIBRARY" title="Foo" description="What I've fooed lately." />

  {hasData ? (
    <ul class="grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map(item => <li>{item.name}</li>)}
    </ul>
  ) : (
    <EmptyState emoji="🎯" title="No items yet" message="Sync hasn't run." />
  )}
</Layout>
```

Use [`PageHeader`](../components/page-header.md) and
[`EmptyState`](../components/empty-state.md) — don't hand-roll the section badge.
The `hasData` boolean is the gate; never render an empty grid.

### 4. Add to the sidebar

Edit `src/components/Sidebar.astro` and add the new page in the right place.
The sidebar is the canonical menu — see
[`components/sidebar.md`](../components/sidebar.md).

### 5. Test locally

```bash
# Populate generated/ from your own keys
cp .env.example .env.local
# (fill the relevant keys)
pnpm run fetch-data

# Dev server
pnpm run dev
```

Hit the new route. Verify both the populated state and the empty state by
temporarily emptying the JSON.

### 6. Visual regression baselines

If `screenshots.spec.ts` is enabled, refresh the baselines:

```bash
pnpm run test:e2e -- --update-snapshots
```

Commit the new baseline PNGs.

### 7. Deploy

See [`deploy.md`](deploy.md).

## See also

- [`architecture/data-flow.md`](../architecture/data-flow.md)
- [`components/page-header.md`](../components/page-header.md)
- [`components/empty-state.md`](../components/empty-state.md)
- [`refresh-firestore-data.md`](refresh-firestore-data.md)
