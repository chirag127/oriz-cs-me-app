---
type: architecture
title: Data flow — authored, generated, mirrored, snapshotted
description: How data moves from JSON files and external APIs into the rendered site and back.
resource: scripts/lib/quality-gate.ts
tags: [architecture, data, firestore, content]
timestamp: 2026-06-19T00:00:00Z
---

# Data flow

There are **two data tracks** that converge on the rendered site: *authored*
content (JSON written by hand) and *generated* content (JSON fetched from APIs).
Both end up under `public/data/` at build time so the static site can serve a
free `/data/*.json` API surface.

## Authored content (manual)

```
src/content/authored/*.json   ← hand-edited (resume, projects, social, etc.)
        │
        │  scripts/mirror-content.ts (runs in `prebuild`)
        ▼
public/data/*.json            ← copied 1:1 for runtime fetches
```

The schemas in `src/content/schemas/*.schema.json` validate authored JSON via
`scripts/validate-content.ts` (uses Ajv). Forkers replace files in
`src/content/authored/` and ship — see
[`sources/rebuild-plan.md`](../sources/rebuild-plan.md) Phase 6.

> Caveat: `src/content/` is **not** an Astro content collection. See
> [`decisions/why-content-folder-is-not-content-collection.md`](../decisions/why-content-folder-is-not-content-collection.md)
> for why this works and what would break it.

## Generated content (API-fetched)

```
external APIs (Trakt, Spotify, Last.fm, GitHub, AniList, Steam, …)
        │
        │  scripts/fetch-data.ts → scripts/lib/quality-gate.ts (commitSection)
        ▼
   ┌──────────────┐               ┌──────────────────────────────┐
   │   Firestore  │ ◄────────────►│ src/content/generated/*.json │
   │  media/<key> │   snapshot    │   (committed periodically)    │
   └──────────────┘    weekly     └──────────────────────────────┘
        │
        │  scripts/mirror-content.ts (also reads generated/ at build)
        ▼
public/data/*.json
```

## Quality gate

`scripts/lib/quality-gate.ts` (`commitSection(key, newData)`) is the guardrail:

1. Load previous snapshot from Firestore `media/<key>` or `public/data/<file>` fallback.
2. Validate `newData`:
   - Reject if a tracked array shrank by more than `SHRINK_THRESHOLD` (0.30 = 30%).
   - Reject on schema mismatch.
3. On pass: write to Firestore *and* the local JSON.
4. On fail: log rejection reasons and KEEP the previous data; next sync retries.
5. Cold start (no previous data anywhere) is treated as "first run" — passes unconditionally.

Tracked array paths (excerpt from `ARRAY_PATHS` in `quality-gate.ts`):

| Section | Arrays |
| --- | --- |
| `movies` | `watched`, `watchlist`, `rated`, `shows` |
| `books` | `read`, `reading`, `wantToRead` |
| `music` | `lastfm.topArtists`, `lastfm.topTracks`, `spotify.topTracks`, `listenbrainz.recentListens`, … |
| `anime` | `anime`, `manga` |
| `gaming` | `steamGames`, `steamRecent` |
| `coding` | `github.repos`, `github.topLanguages` |
| `social` | `devto`, `bluesky`, `youtube.videos` |

## Triggers

| Trigger | What runs | Cadence | Workflow |
| --- | --- | --- | --- |
| Push to `main` | `prebuild` → mirror authored + generated → `astro build` → deploy | per push | `daily-build.yml` |
| Cron 6h | `fetch-data.ts` → quality-gate → Firestore writes | every 6 h | `sync-firestore.yml` |
| Cron Mondays | Read Firestore → write `src/content/generated/*.json` → commit | weekly | `snapshot-weekly.yml` |
| Cron daily | OpenRouter `:free` catalog refresh | daily | `refresh-models.yml` |
| Cron daily | Resume PDFs → GitHub Release | daily | `build-resume.yml` |

## Firestore reads at runtime

Beyond the static `/data/*.json` mirror, the site reads Firestore directly for:

- Auth state (Google + email/pass).
- Chat history (`chatMessages`, `chatSessions`).
- Public-read `media/<key>` collection — same data as the JSON mirror but live.

See [`integrations/firestore.md`](../integrations/firestore.md) for collection
list and security rules; [`auth.md`](auth.md) for who can write what.

## Local refresh

To populate `src/content/generated/` locally without waiting for CI:

```bash
cp .env.example .env.local
# fill Trakt, Spotify, Last.fm, … keys
pnpm run fetch-data
```

See [`runbooks/refresh-firestore-data.md`](../runbooks/refresh-firestore-data.md).

## See also

- [`overview.md`](overview.md), [`auth.md`](auth.md)
- [`integrations/firestore.md`](../integrations/firestore.md)
- [`runbooks/refresh-firestore-data.md`](../runbooks/refresh-firestore-data.md)
