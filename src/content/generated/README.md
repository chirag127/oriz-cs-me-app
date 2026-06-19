# Generated data — written by CI

This folder is **CI-generated**. Do not hand-edit.

- **Written by:** `scripts/fetch-data.ts` (orchestrated by `.github/workflows/sync-firestore.yml`, every 6h)
- **Committed by:** `.github/workflows/snapshot-weekly.yml` (Mondays)
- **Validated by:** `scripts/lib/quality-gate.ts` — bad fetches don't overwrite previous data

## Files

Each `<key>.json` corresponds to a Firestore doc at `media/<key>`:

| File                  | Source APIs                                                         |
| --------------------- | ------------------------------------------------------------------- |
| `movies.json`         | Trakt + TMDB + TVMaze (posters)                                     |
| `books.json`          | OpenLibrary                                                         |
| `music.json`          | Last.fm + Spotify + ListenBrainz                                    |
| `anime.json`          | AniList + Jikan                                                     |
| `games.json`          | Steam + Lichess (filename `games`, doc id `gaming`)                 |
| `coding.json`         | GitHub + WakaTime + LeetCode + Codewars                             |
| `social.json`         | DevTo + HackerNews + Bluesky + YouTube                              |
| `mastodon.json`       | Mastodon                                                            |
| `reddit.json`         | Reddit                                                              |
| `music-platforms.json`| Mixcloud                                                            |
| `dev-stats.json`      | NPM + StackOverflow + Holopin                                       |

## Local development without API keys

Pages handle missing files gracefully (`try/catch` → empty arrays + a
console warn) — the site builds and renders even if this folder is empty.
Stat strips show "0" and lists show fallback gradients.

## Local development WITH API keys

1. Copy `.env.example` → `.env.local`, fill in credentials.
2. Run `pnpm run fetch-data` once — populates this folder + Firestore.
3. Build / run as normal.
