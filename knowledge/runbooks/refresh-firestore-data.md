---
type: runbook
title: Refresh Firestore data manually
description: Trigger sync-firestore.yml via workflow_dispatch, or run pnpm run fetch-data locally with .env.local.
tags: [runbook, firestore, data, sync]
timestamp: 2026-06-19T00:00:00Z
---

# Runbook: Refresh Firestore data

Two paths: GitHub Actions (no local secrets needed) or local (faster feedback).

## Path A — GitHub Actions

The cron schedule (every 6 h) covers most needs, but you can force a run.

1. Go to the repo → **Actions** → **`sync-firestore.yml`**.
2. Click **"Run workflow"**.
3. Pick `main`. Submit.
4. Watch the job. It runs `scripts/fetch-data.ts` with the secrets stored in
   the repo settings (Firebase Admin, Trakt, Spotify, Last.fm, GitHub, etc.).
5. The quality gate (see
   [`architecture/data-flow.md`](../architecture/data-flow.md)) writes accepted
   sections to Firestore `media/<key>` and refuses bad ones.

This does **not** commit `src/content/generated/*.json`. That happens weekly
via `snapshot-weekly.yml` on Mondays. To commit immediately, either wait for
Monday or run path B locally and commit the snapshot manually.

## Path B — Local

### Preconditions

```bash
# 1. Copy the env template
cp .env.example .env.local

# 2. Fill the API keys you care about. .env.example has sourcing instructions.
#    Minimum useful set depends on which sections you want to refresh:
#    - movies/tv/anime → TRAKT_CLIENT_ID, TMDB_API_KEY
#    - books → (handled via OpenLibrary public APIs, no key)
#    - music → LASTFM_API_KEY, SPOTIFY_*, ListenBrainz public
#    - gaming → STEAM_API_KEY, STEAM_USER_ID
#    - coding → GITHUB_TOKEN
#    - social → DEVTO_API_KEY, BLUESKY_*, YOUTUBE_*
#    - Firestore writes → FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY (admin SDK)

# 3. Install deps
pnpm install
```

### Run

```bash
pnpm run fetch-data
```

This calls `scripts/fetch-data.ts`, which iterates sections, fetches APIs,
runs each through `commitSection(key, newData)` from
`scripts/lib/quality-gate.ts`, and writes to:

- Firestore `media/<key>` (if Firebase Admin creds are present).
- `public/data/<key>.json` (always).

### Commit the snapshot

```bash
git add src/content/generated/ public/data/
git commit -m "chore(data): refresh from local sync"
```

(You can also run `pnpm run mirror-content` to regenerate `public/data/` from
`src/content/generated/` without re-fetching.)

## Sanity checks

- `public/data/<key>.json` should have a recent `lastUpdated` (or analogous) timestamp.
- Tracked arrays should be roughly the same size as before — the quality gate
  rejects shrinks > 30% and logs the rejection.
- If a section silently skipped, look for `[quality-gate] reject` lines in the
  output — usually means an API key is missing or the API is rate-limiting.

## See also

- [`architecture/data-flow.md`](../architecture/data-flow.md)
- [`integrations/firestore.md`](../integrations/firestore.md)
- [`deploy.md`](deploy.md)
