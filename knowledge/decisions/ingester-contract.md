---
type: decision
title: "Self-healing ingester contract for me.oriz.in"
description: "Every lifestream ingester must satisfy these properties so the site survives 6-month absences, the 7-day fix-or-pause SLA works, and the /status page is honest."
tags: [decision, ingester, lifestream, durability]
timestamp: 2026-06-19
---

# Self-healing ingester contract for me.oriz.in

> Status: **active contract**, decided 2026-06-19.
> Re-read on every birthday alongside the parent strategy doc. Each new
> ingester PR must check itself against the 6 properties below before merge.

## 1. Why this contract exists

The [100-year strategy](./100-year-strategy.md) names **engagement death** as
one of three top failure modes (§4) — Chirag loses interest, ingesters go
stale, the site rots into a graveyard of broken sync timestamps. Two
sections of that doc carry the load against this failure mode and both
require ingester behaviour the runtime cannot guess at:

- **§9 — 7-day fix-or-pause SLA.** When an ingester breaks, day 0–7 is the
  fix window; on day 7+ it auto-pauses and the `/status` page surfaces a
  red dot for that source while the rest of the site keeps working. An
  ingester that auto-pauses 3 times in a year gets a hard re-eval.
- **§15 — Self-healing during 6-month absences.** The system must keep
  running for 6 months without any human touch: cron continues to fire,
  upstream backfill catches gaps when Chirag returns, the status page
  shows what survived honestly.

Neither §9 nor §15 works unless every ingester is written to a shared
contract. This doc is that contract. If a future ingester cannot satisfy
all 6 properties below, it does not ship — per §14 of the strategy doc,
"100% automated or it doesn't ship" extends to "100% self-healing or it
doesn't ship".

## 2. The 6 properties every ingester MUST satisfy

### 2.1. Idempotent writes

**Why.** Cron retries, manual reruns, full-history backfills after a long
absence, and Cloudflare Worker restarts all re-invoke the same ingester
against overlapping windows of upstream data. Re-running an ingester must
write zero new rows for events it already captured — otherwise a 6-month
backfill mid-2026 produces 6 months of duplicate scrobbles.

**Shape.** Every event carries a deterministic dedup key on
`(source, external_id, occurred_at)`. The `events` table enforces this as
a `UNIQUE` constraint and the canonical JSONL appender consults the same
key before appending a line.

```ts
// Idempotency is provided by the storage layer — the ingester just
// hands raw events in. Both `appendEvent` (jsonl.ts) and
// `batchUpsert` (upsert.ts) silently skip duplicates on the
// (source, external_id, occurred_at) tuple. `appendEvent` dedupes
// against the last 1000 lines of the target shard before it writes;
// `batchUpsert` uses SQLite's `INSERT OR IGNORE`.
const events: EventInput[] = tracks.map((t) => ({
  source: 'lastfm',
  kind: 'song',
  external_id: t.mbid ?? `${t.artist}|${t.name}`, // stable, NOT a timestamp
  occurred_at: new Date(t.uts * 1000).toISOString(),
  title: t.name,
  subtitle: t.artist,
}));
await batchAppend(REPO_PATH, events); // dedupes on (source, external_id, occurred_at)
```

### 2.2. Backfill-capable on first run after a gap

**Why.** §15 demands that an ingester woken after 6 months of silence
catches the gap, not just the last hour. Most upstreams expose two
endpoints — a cheap "recent N items" feed and a paginated full-history
endpoint. A naive ingester always hits the cheap one and silently loses
178 days of scrobbles.

**Shape.** Read `last_synced_at` from the `sources` table. If it is null
or older than the upstream's recent-feed window, switch to the full-
history endpoint with the saved cursor.

```ts
const lastSync = await getLastSync(client, 'lastfm'); // from sources table
const since = lastSync ?? new Date('2026-06-19'); // epoch fallback for first-ever run
const tracks = since < oneDayAgo
  ? await fetchFullHistoryFromLastFm(env, since) // paginated, expensive
  : await fetchRecentFromLastFm(env);            // cheap
```

### 2.3. Auto-pause after 7 consecutive daily failures

**Why.** Per §9, an ingester that has been broken for 7 days is by
definition outside the SLA — Chirag has missed the fix window. Retrying
forever burns Cloudflare Workers cron quota, fills the error log with
the same exception, and hides the problem behind noise. Pausing makes
the failure loud on `/status` and silent in the logs.

**Shape.** The `sources` table grows a `consecutive_failures` counter.
Each error increments it; each success resets it to 0. At 7, the
ingester writes `last_error = 'auto-paused after 7d failures'` and
returns immediately. The cron keeps firing — the body short-circuits.
A one-line `pnpm ingest:reset <source>` script clears the pause.

```ts
const status = await getSourceStatus(client, SOURCE);
if ((status?.consecutive_failures ?? 0) >= 7) {
  return; // paused; manual reset clears it
}
```

### 2.4. Status reporting on every run

**Why.** The `/status` page is the only mechanism that surfaces ingester
health to the public — and the public visibility is the social pressure
that keeps the SLA honest. Skipping a status write on a "boring" success
breaks the sparkline. Skipping it on failure hides the failure.

**Shape.** Every ingester ends — success or failure — with a call to
[`recordSyncStatus`](../../src/lib/lifestream/upsert.ts). On success
pass `error: null`. On failure pass `error: err.message` (truncated to
fit the column). Partial success (some events written, some pages of
the upstream API failed) writes `error: null` plus a `degraded: true`
flag in metadata so the UI can render an amber dot, not green.

```ts
try {
  // … ingest …
  await recordSyncStatus(client, { name: SOURCE, error: null });
} catch (err) {
  await recordSyncStatus(client, {
    name: SOURCE,
    error: err instanceof Error ? err.message : String(err),
  });
}
```

### 2.5. Bounded execution time

**Why.** Cloudflare Workers Cron triggers on the free tier have a
60-second wall-clock limit. An ingester that tries to backfill 6 months
of Last.fm scrobbles in one run hits the limit, gets killed, and on
the next run starts over from the same `since` cursor — making zero
progress forever. The contract is **commit what you have, resume from
the new high-water mark**.

**Shape.** Track elapsed time. When approaching the cap, break out of
the pagination loop, flush whatever is in memory, and update
`last_synced_at` to the latest `occurred_at` actually persisted. The
next cron tick picks up from that point.

```ts
const deadline = Date.now() + 50_000; // 10s of headroom under the 60s cap
for await (const page of paginate(env, since)) {
  await batchAppend(REPO_PATH, page.events);
  if (Date.now() > deadline) break; // resume next run
}
```

### 2.6. No secrets in code

**Why.** The `chirag127/oriz-me-data` repo is public (per §10 of the
strategy doc), and the site source repo may go public too. A token
checked into git is a token leaked forever — git history makes
deletion useless.

**Shape.** Every credential reads from the env binding (Cloudflare
Workers `env`, GitHub Actions secrets, or process env on local dev).
Document the required env vars in a comment block at the top of every
ingester file so the deployer knows what to provision.

```ts
/**
 * Required env bindings:
 *   - LASTFM_API_KEY        Last.fm API key (read-only, free tier)
 *   - JSONL_REPO_PATH       Mounted path to chirag127/oriz-me-data
 *   - TURSO_WRITE_URL       libSQL write endpoint (rebuild-cache only)
 *   - TURSO_WRITE_TOKEN     libSQL write token  (rebuild-cache only)
 */
```

## 3. The /status page contract

The public `/status` page is the externally-visible mirror of the
`sources` table. One row per `EventSource`. The page is **public** —
failures are visible to recruiters, and the visibility is the point;
it forces fixes faster than any private alert ever did for Chirag.

Layout — fixed-pitch grid:

```
LASTFM        ●●●●●●●●  synced 2m ago             —
LISTENBRAINZ  ●●●●●●●●  synced 1m ago             —
SIMKL         ●●●●●○○○  paused 3 days ago         http 401 from /v1/sync
GITHUB        ●●●●●●●○  synced 1h ago             rate limited (degraded)
```

Columns, in order:

- **Source name.** Mono caps, padded to a fixed width.
- **8-day rolling sparkline.** One dot per day, oldest → newest. Green
  on a day with at least one success, red on a day with only failures,
  amber on a partial-success (degraded) day, hollow on a paused day.
- **Last sync time.** Relative ("2m ago", "3 days ago"). Pulses when <
  the source's expected cadence; stale and red when 3× the cadence.
- **Last error.** Truncated to 80 chars with an ellipsis; full text in a
  tooltip / on-click expand. Empty (em-dash) on healthy rows.

The implementation lives at `src/pages/status.astro` and reads through
the same Turso cache the rest of the live-data pages use; see
`tasks.md` #98–99.

## 4. The annual ingester audit

On Chirag's birthday each year, run `pnpm audit:ingesters`. The script:

- Lists every ingester registered with the runtime (`functions/scheduled/ingest-*.ts`).
- For each, queries the `sources` table for the count of distinct
  auto-pauses in the last 365 days.
- Flags any ingester that auto-paused **3+ times** in the year. These
  get a hard re-evaluation, with three legitimate outcomes:
  1. Fix the root cause — the failure mode is understood and now
     guarded against.
  2. Replace the upstream — same data, different provider (Last.fm →
     ListenBrainz, Goodreads → Hardcover, etc.).
  3. Remove the source — accept that this signal is gone, delete the
     ingester, drop the page section.
- Writes the report into the year's strategy review notes alongside the
  §6 / §10 / §15 re-reads from the parent strategy doc.

## 5. Reference implementation skeleton

When writing a new ingester, copy the skeleton below and fill in the
upstream-specific `fetchUpstream` function. All 6 properties are wired
in already; deleting any of them violates the contract.

```ts
// functions/scheduled/ingest-<source>.ts
//
// Required env bindings:
//   - <SOURCE>_API_KEY      Upstream API credential
//   - JSONL_REPO_PATH       Mounted path to chirag127/oriz-me-data
//   - TURSO_WRITE_URL       libSQL write endpoint
//   - TURSO_WRITE_TOKEN     libSQL write token
import { getCacheRebuildClient } from '../../src/lib/lifestream/db';
import { recordSyncStatus, batchUpsert } from '../../src/lib/lifestream/upsert';
import { batchAppend } from '../../src/lib/lifestream/jsonl';
import type { EventInput } from '../../src/lib/lifestream/types';

export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
  const SOURCE = '<source-name>';
  const REPO_PATH = env.JSONL_REPO_PATH;
  const client = getCacheRebuildClient();

  // (3) Auto-pause check
  const status = await getSourceStatus(client, SOURCE);
  if ((status?.consecutive_failures ?? 0) >= 7) {
    return; // paused; manual reset clears it
  }

  try {
    // (2) Backfill-capable: read last_synced_at, fetch from upstream since then
    const since = status?.last_synced_at ?? new Date('2026-06-19').toISOString();

    // (5) Bounded execution time: pass deadline into the fetcher
    const deadline = Date.now() + 50_000;
    const events: EventInput[] = await fetchUpstream(env, since, deadline); // per-source

    // (1) Idempotent: batchAppend dedupes on (source, external_id, occurred_at)
    await batchAppend(REPO_PATH, events);

    // (4) Status reporting on success
    await recordSyncStatus(client, { name: SOURCE, error: null });
  } catch (err) {
    // (4) Status reporting on failure — increments consecutive_failures
    await recordSyncStatus(client, {
      name: SOURCE,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
```

## 6. Cross-references

- 100-year strategy: [`100-year-strategy.md`](./100-year-strategy.md) — esp. §9 + §15
- Lifestream types: [`src/lib/lifestream/types.ts`](../../src/lib/lifestream/types.ts) (`SourceStatus` interface)
- Lifestream upsert: [`src/lib/lifestream/upsert.ts`](../../src/lib/lifestream/upsert.ts) (`recordSyncStatus` function)
- /status page implementation: tasks.md #98–99
