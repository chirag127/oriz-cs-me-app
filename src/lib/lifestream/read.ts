/**
 * Hybrid live + archive reader for the lifestream.
 *
 * Per the 100-year-strategy decision (§10), the consumer-facing data path
 * is split in two:
 *
 *   1. Live last-N-hours  — served from Turso, edge-cached at the Pages
 *      Function layer. This is hot data; the JSONL ingester writes happen
 *      every few minutes and the cache-rebuild script re-projects them
 *      into Turso on a short cron, so the cache is always close to fresh.
 *
 *   2. Older archive       — served from pre-built JSON snapshots committed
 *      to the site repo at `public/data/lifestream/*.json`. A daily cron
 *      regenerates these snapshots from the JSONL canonical store. They're
 *      static files on Cloudflare Pages and so survive Turso going dark.
 *
 * The home page wants both layers stitched together — see `getMergedFeed`.
 *
 * Visibility filtering: this layer surfaces `public` events plus
 * `age-gated-18` events. The age-gated rows are returned unfiltered; the
 * downstream UI is responsible for hiding them behind the AgeGate component
 * until the visitor confirms 18+. The `aggregates-only`, `unlisted`, and
 * `private` rows are NEVER returned by these helpers.
 */

import type { Client } from '@libsql/client';
import type {
  Event,
  EventKind,
  EventSource,
  EventVisibility,
} from './types.ts';

/**
 * Options shared by the read helpers.
 */
export interface RecentEventsOptions {
  /** How far back to read, in hours. Default 24. */
  hoursBack?: number;
  /** Optional restrict to specific event kinds. */
  kinds?: EventKind[];
  /** Optional restrict to specific sources. */
  sources?: EventSource[];
  /** Result cap; older events are dropped first. Default 200. */
  limit?: number;
}

/** Visibilities the public read path is allowed to surface. */
const SURFACED_VISIBILITIES: EventVisibility[] = ['public', 'age-gated-18'];

/**
 * Read the last N hours of events from the Turso warm cache. Used by Pages
 * Functions and the home page's live ribbon. The result is sorted DESC by
 * `occurred_at` (newest first) and capped at `limit` rows.
 *
 * Returns `age-gated-18` rows alongside `public` rows; the consumer (Astro
 * page or React island) decides whether to render them gated or hidden.
 */
export async function getRecentLiveEvents(
  client: Client,
  options: RecentEventsOptions = {},
): Promise<Event[]> {
  const hoursBack = options.hoursBack ?? 24;
  const limit = options.limit ?? 200;
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  const filters: string[] = ['occurred_at >= ?', 'visibility IN (?, ?)'];
  const args: (string | number)[] = [
    since,
    SURFACED_VISIBILITIES[0] ?? 'public',
    SURFACED_VISIBILITIES[1] ?? 'age-gated-18',
  ];

  if (options.kinds && options.kinds.length > 0) {
    filters.push(`kind IN (${options.kinds.map(() => '?').join(', ')})`);
    args.push(...options.kinds);
  }
  if (options.sources && options.sources.length > 0) {
    filters.push(`source IN (${options.sources.map(() => '?').join(', ')})`);
    args.push(...options.sources);
  }

  const sql = `
    SELECT id, occurred_at, source, kind,
           title, subtitle,
           external_id, external_url, cover_url,
           progress, rating, metadata,
           visibility, ingested_at
    FROM events
    WHERE ${filters.join(' AND ')}
    ORDER BY occurred_at DESC
    LIMIT ?
  `;
  args.push(limit);

  const result = await client.execute({ sql, args });
  return result.rows.map(rowToEvent);
}

/**
 * Read a pre-built static JSON snapshot from the site's public/ directory.
 * `archiveJsonPath` is the absolute path to the JSON file (e.g.
 * `/public/data/lifestream/2025.json`). The file is expected to contain a
 * top-level array of `Event` objects, sorted however the cron produced
 * them.
 *
 * Server-side helper. Don't import this from a browser bundle — use a
 * `fetch` to the same path from the client instead.
 */
export async function getStaticArchive(
  archiveJsonPath: string,
): Promise<Event[]> {
  // Use dynamic import so this module stays compatible with both the Node
  // build (Astro server pages, scripts) and the Workers/Pages-Functions
  // runtime (which can't import 'node:fs/promises' eagerly). Callers that
  // run on Workers must not pass a file path at all; they should fetch the
  // JSON over HTTP instead.
  const { readFile } = await import('node:fs/promises');
  const text = await readFile(archiveJsonPath, 'utf8');
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((row): row is Event => isEvent(row));
}

/**
 * Live last-N-hours + static archive, deduped by `id`, sorted DESC by
 * `occurred_at`. This is the canonical home-page feed.
 *
 * Dedup rule: when the same id appears in both layers (which can happen
 * for the few minutes after a daily snapshot is generated but before its
 * cutoff has rolled forward), the LIVE row wins because it was projected
 * most recently from JSONL.
 */
export async function getMergedFeed(
  client: Client,
  archivePath: string,
  options: RecentEventsOptions = {},
): Promise<Event[]> {
  const [live, archive] = await Promise.all([
    getRecentLiveEvents(client, options),
    getStaticArchive(archivePath).catch(() => [] as Event[]),
  ]);

  const seen = new Set<string>();
  const merged: Event[] = [];
  for (const ev of live) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    merged.push(ev);
  }
  for (const ev of archive) {
    if (seen.has(ev.id)) continue;
    if (!SURFACED_VISIBILITIES.includes(ev.visibility)) continue;
    seen.add(ev.id);
    merged.push(ev);
  }

  merged.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  const limit = options.limit ?? 200;
  return merged.slice(0, limit);
}

// ---------- internal helpers ----------

/**
 * Coerce a libSQL row (an object whose values are strings/numbers/null) into
 * a typed `Event`. Parses the `metadata` JSON column on the way through.
 */
function rowToEvent(row: Record<string, unknown>): Event {
  const metadataRaw = row.metadata;
  let metadata: Record<string, unknown> | null = null;
  if (typeof metadataRaw === 'string' && metadataRaw.length > 0) {
    try {
      metadata = JSON.parse(metadataRaw) as Record<string, unknown>;
    } catch {
      metadata = null;
    }
  } else if (metadataRaw && typeof metadataRaw === 'object') {
    metadata = metadataRaw as Record<string, unknown>;
  }

  return {
    id: String(row.id ?? ''),
    occurred_at: String(row.occurred_at ?? ''),
    source: row.source as EventSource,
    kind: row.kind as EventKind,
    title: (row.title as string | null) ?? null,
    subtitle: (row.subtitle as string | null) ?? null,
    external_id: (row.external_id as string | null) ?? null,
    external_url: (row.external_url as string | null) ?? null,
    cover_url: (row.cover_url as string | null) ?? null,
    progress: (row.progress as number | null) ?? null,
    rating: (row.rating as number | null) ?? null,
    metadata,
    visibility: (row.visibility as EventVisibility) ?? 'public',
    ingested_at: String(row.ingested_at ?? ''),
  };
}

/**
 * Cheap structural check for `Event` shape, used when reading static
 * snapshots that we don't fully trust.
 */
function isEvent(value: unknown): value is Event {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.occurred_at === 'string' &&
    typeof v.source === 'string' &&
    typeof v.kind === 'string' &&
    typeof v.visibility === 'string'
  );
}
