---
type: source-of-truth
title: Tracker landscape 2026 — external research
description: Summary of recent shifts in tracking-service APIs (Trakt, Letterboxd, Goodreads, Pocket, Strava, Steam, YouTube). Informs Phase 2+.
tags: [source, research, trackers, api, landscape]
timestamp: 2026-06-19T00:00:00Z
---

# Tracker landscape — 2026

External research summarizing recent changes in the read/write APIs of services
the `/library/*`, `/code/*`, and `/connect/*` pages consume. This is the
landscape that informs **Phase 2+** decisions in
[`rebuild-plan.md`](rebuild-plan.md): which trackers we depend on, which we
shadow with our own data, and which we drop.

> Source: 4 oriz-blog posts that the user pasted on 2026-06-19. The blog is the
> primary source; this page is the durable summary so future agents don't have
> to re-fetch.

## Key facts

| Service | Status | Detail |
| --- | --- | --- |
| **Trakt** | Restricted | Feb-2026 introduced rate limits + per-app quotas. Read-only fetches still work but high-frequency syncs fail; `sync-firestore.yml` 6-hour cadence is fine, finer is not. |
| **Letterboxd** | Ad-supported, no API | Officially still no public write API. The unofficial scraping route is brittle and against ToS. We stay on Trakt. |
| **Goodreads** | Ad-supported, API gone | Goodreads killed its public API in 2020; never came back. Use OpenLibrary or Hardcover for book data instead. |
| **Pocket** | Dead | Mozilla shut it down in 2025. If we have legacy Pocket data, treat it as historical. |
| **Strava** | Paywalled | Free tier reads still work for personal data; premium-feature reads need a subscription. Public profile readouts are now gated. |
| **Steam** | Read-only | API remains read-only (always was). Game library, recently played, achievements all still fetchable with `STEAM_API_KEY`. No write needed. |
| **YouTube** | No write API for individuals | YouTube Data API v3 gives reads (channel videos, stats) but write/upload for personal channels requires OAuth flow. We only need reads — see `.env.example` `YOUTUBE_API_KEY` + `YOUTUBE_CHANNEL_ID`. |

## What this means for the site

- **Library/movies + TV + anime** continue to use Trakt as the source of truth
  (see [`integrations/firestore.md`](../integrations/firestore.md) `media/movies`).
  Cadence locked at 6 hours.
- **Library/books** does not depend on Goodreads. Use OpenLibrary public
  endpoints (no API key) for book metadata; canonical "read" list lives in
  authored JSON or AniList-equivalent.
- **Library/podcasts** — no central tracker exists with a friendly API; we
  authored the list manually.
- **Connect/strava** — if surfaced, expect free-tier-only data.
- **Code/youtube** — read-only endpoint. Live.
- **Pocket** — do **not** add a Pocket integration. Service is dead.
- **Letterboxd / Goodreads buttons in /connect/** — link out only, no API
  consumption.

## Phase implications

- Phase 2's status strip relies on **Lanyard + ListenBrainz + Open-Meteo** —
  all confirmed alive and free. See
  [`components/status-strip.md`](../components/status-strip.md).
- Phase 4's quality-gate hardening protects against the kind of silent failures
  these services occasionally throw (Trakt rate-limit returning 200 with empty
  body, etc.). See [`architecture/data-flow.md`](../architecture/data-flow.md).
- Phase 6's secrets walkthrough order intentionally puts the more reliable
  services first (Firebase → OpenRouter) and the brittle ones (Trakt, Spotify)
  in the middle so partial setup still produces a working site.

## Gaps (TBD by author)

- TBD: Is there a current AniList rate limit constraint we should record here?
- TBD: ListenBrainz public API — confirm no auth needed for the now-playing
  endpoint we use on the homepage.
- TBD: Lanyard — sustainability of the public Lanyard API; is the project still
  maintained as of 2026?

## See also

- [`rebuild-plan.md`](rebuild-plan.md)
- [`../architecture/data-flow.md`](../architecture/data-flow.md)
- [`../runbooks/refresh-firestore-data.md`](../runbooks/refresh-firestore-data.md)
- [`../runbooks/add-new-tracker-page.md`](../runbooks/add-new-tracker-page.md)
