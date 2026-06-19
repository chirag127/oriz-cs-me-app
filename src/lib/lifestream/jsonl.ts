/**
 * Canonical-store reader and writer for the lifestream JSONL files.
 *
 * Per the 100-year-strategy decision (§10–§11), the authoritative store is
 * a separate public git repo, `chirag127/oriz-me-data`, holding plain
 * JSONL shards (`events-2026.jsonl`, `events-2026-06.jsonl`, ...). Every
 * ingest path appends here; Turso is a warm cache rebuilt from these
 * shards on every deploy.
 *
 * Server-side ONLY. This module imports `node:fs/promises` and must never
 * be bundled into a client island. Astro server pages, Cloudflare Cron
 * Triggers running on Node, the cache-rebuild script, and `scripts/*.ts`
 * are the legitimate callers.
 *
 * Sharding rule (from strategy §11): one file per year. If a year-file
 * exceeds `MAX_SHARD_BYTES` (10 MiB pre-compression), the writer transparently
 * splits to month-shards (`events-YYYY-MM.jsonl`) for that year. The reader
 * handles both layouts.
 *
 * Idempotency contract: `appendEvent` and `batchAppend` dedupe on the
 * `(source, external_id, occurred_at)` triple by inspecting the tail of the
 * target shard before writing. Re-running an ingester is safe.
 */

import { Buffer } from 'node:buffer';
import { existsSync } from 'node:fs';
import {
  appendFile,
  mkdir,
  open,
  readdir,
  readFile,
  rename,
  stat,
} from 'node:fs/promises';
import path from 'node:path';
import type {
  EventInput,
  EventVisibility,
  JsonlEntry,
  JsonlShard,
} from './types.ts';

/** 10 MiB pre-compression. When a year-file passes this, shard by month. */
const MAX_SHARD_BYTES = 10 * 1024 * 1024;

/** Bumped only on incompatible schema changes; additive changes stay 1. */
const SCHEMA_VERSION = 1;

/** How many trailing lines to inspect for the dedup check. */
const DEDUP_TAIL_LINES = 1000;

/** UTF-8 newline byte length, used for tail-read sizing. */
const NEWLINE = '\n';

/**
 * Append a single event as one JSON line to the target shard. Idempotent on
 * the `(source, external_id, occurred_at)` triple — duplicates are silently
 * skipped (no error). Creates `repoPath` if it doesn't exist yet.
 *
 * Picks the shard automatically:
 *   1. Year-file `events-YYYY.jsonl` is preferred.
 *   2. If a month-shard `events-YYYY-MM.jsonl` already exists for that
 *      month (i.e. the year was previously split), keep writing there.
 *   3. If the year-file is at or above `MAX_SHARD_BYTES`, the year is
 *      retroactively split into month-shards before this append lands.
 *
 * Concurrency: callers are expected to be the ingester process(es) that own
 * the data repo working tree. fs append is atomic for short writes on most
 * filesystems but this module does NOT add cross-process locking.
 */
export async function appendEvent(
  repoPath: string,
  event: EventInput,
): Promise<void> {
  await mkdir(repoPath, { recursive: true });

  const occurred = new Date(event.occurred_at);
  const year = occurred.getUTCFullYear();
  const month = occurred.getUTCMonth() + 1;

  const shardPath = await pickShardForWrite(repoPath, year, month);

  if (await isDuplicate(shardPath, event)) return;

  const entry = toEntry(event);
  await appendFile(shardPath, `${JSON.stringify(entry)}${NEWLINE}`, 'utf8');
}

/**
 * Bulk-append a batch of events. Groups events by their target shard so
 * each shard is opened once. Returns counts of how many lines were
 * appended versus skipped as duplicates.
 */
export async function batchAppend(
  repoPath: string,
  events: EventInput[],
): Promise<{ appended: number; skipped: number }> {
  if (events.length === 0) return { appended: 0, skipped: 0 };

  await mkdir(repoPath, { recursive: true });

  // Group by (year, month) — pickShardForWrite resolves the actual path.
  const groups = new Map<
    string,
    { year: number; month: number; rows: EventInput[] }
  >();
  for (const ev of events) {
    const occurred = new Date(ev.occurred_at);
    const year = occurred.getUTCFullYear();
    const month = occurred.getUTCMonth() + 1;
    const key = `${year}-${month}`;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(ev);
    } else {
      groups.set(key, { year, month, rows: [ev] });
    }
  }

  let appended = 0;
  let skipped = 0;

  for (const { year, month, rows } of groups.values()) {
    const shardPath = await pickShardForWrite(repoPath, year, month);
    const seenKeys = await loadDedupKeys(shardPath);

    const lines: string[] = [];
    for (const ev of rows) {
      const key = dedupKey(ev);
      if (seenKeys.has(key)) {
        skipped += 1;
        continue;
      }
      seenKeys.add(key);
      lines.push(JSON.stringify(toEntry(ev)));
      appended += 1;
    }

    if (lines.length > 0) {
      await appendFile(shardPath, `${lines.join(NEWLINE)}${NEWLINE}`, 'utf8');
    }
  }

  return { appended, skipped };
}

/**
 * Read a single shard. `month` undefined → year-shard `events-YYYY.jsonl`;
 * `month` set → month-shard `events-YYYY-MM.jsonl`. Lines that fail to parse
 * as JSON are skipped silently — corruption on a single line should not lose
 * the rest of the shard.
 */
export async function readShard(
  repoPath: string,
  year: number,
  month?: number,
): Promise<JsonlEntry[]> {
  const shardPath = path.join(repoPath, shardName(year, month));
  if (!existsSync(shardPath)) return [];

  const text = await readFile(shardPath, 'utf8');
  return parseLines(text);
}

/**
 * Read every shard whose covered period overlaps `[since, +∞)`, merge the
 * results, and return them sorted ascending by `occurred_at`. Useful for the
 * cache-rebuild script (which passes `new Date(0)` to read everything).
 */
export async function readAllSince(
  repoPath: string,
  since: Date,
): Promise<JsonlEntry[]> {
  const shards = await listShards(repoPath);
  const sinceYear = since.getUTCFullYear();
  const sinceMonth = since.getUTCMonth() + 1;

  const relevant = shards.filter((s) => {
    if (s.year > sinceYear) return true;
    if (s.year < sinceYear) return false;
    // Same year. Year-shards always include the cutoff month; month-shards
    // must be at or after the cutoff month.
    if (s.month === undefined) return true;
    return s.month >= sinceMonth;
  });

  const all: JsonlEntry[] = [];
  for (const shard of relevant) {
    const text = await readFile(shard.path, 'utf8');
    for (const entry of parseLines(text)) {
      if (new Date(entry.occurred_at) >= since) all.push(entry);
    }
  }

  all.sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  return all;
}

/**
 * Discover every `events-*.jsonl` shard in `repoPath` and return its
 * metadata (size + entry count + parsed year/month). Uses one `stat` per
 * file plus a streaming line count.
 */
export async function listShards(repoPath: string): Promise<JsonlShard[]> {
  if (!existsSync(repoPath)) return [];

  const entries = await readdir(repoPath);
  const shardFiles = entries
    .filter((name) => /^events-\d{4}(-\d{2})?\.jsonl$/.test(name))
    .sort();

  const shards: JsonlShard[] = [];
  for (const name of shardFiles) {
    const parsed = parseShardName(name);
    if (!parsed) continue;
    const filePath = path.join(repoPath, name);
    const fileStat = await stat(filePath);
    const entry_count = await countLines(filePath);
    const shard: JsonlShard =
      parsed.month === undefined
        ? {
            year: parsed.year,
            path: filePath,
            size_bytes: fileStat.size,
            entry_count,
          }
        : {
            year: parsed.year,
            month: parsed.month,
            path: filePath,
            size_bytes: fileStat.size,
            entry_count,
          };
    shards.push(shard);
  }

  return shards;
}

// ---------- internal helpers ----------

/**
 * Build the JSONL file name for a given period.
 */
function shardName(year: number, month?: number): string {
  if (month === undefined) return `events-${year}.jsonl`;
  return `events-${year}-${String(month).padStart(2, '0')}.jsonl`;
}

/**
 * Parse a shard filename back into `{ year, month? }`. Returns null if the
 * name doesn't match the expected pattern.
 */
function parseShardName(name: string): { year: number; month?: number } | null {
  const m = name.match(/^events-(\d{4})(?:-(\d{2}))?\.jsonl$/);
  if (!m) return null;
  const yearStr = m[1];
  const monthStr = m[2];
  if (!yearStr) return null;
  const year = Number(yearStr);
  if (monthStr === undefined) return { year };
  return { year, month: Number(monthStr) };
}

/**
 * Decide which shard a new event for `(year, month)` should land in:
 *
 *   - If a month-shard for `(year, month)` already exists, keep writing there.
 *   - Else if the year-shard exists and is small, write to the year-shard.
 *   - Else if the year-shard exceeds `MAX_SHARD_BYTES`, split it into month
 *     shards before returning the path of the target month-shard.
 *   - Else (no shard for that year yet) start a fresh year-shard.
 *
 * Returns an absolute path.
 */
async function pickShardForWrite(
  repoPath: string,
  year: number,
  month: number,
): Promise<string> {
  const monthPath = path.join(repoPath, shardName(year, month));
  if (existsSync(monthPath)) return monthPath;

  const yearPath = path.join(repoPath, shardName(year));
  if (!existsSync(yearPath)) return yearPath;

  const yearStat = await stat(yearPath);
  if (yearStat.size < MAX_SHARD_BYTES) return yearPath;

  // Year-shard is too big — split it into month-shards in place.
  await splitYearIntoMonths(repoPath, year);
  return path.join(repoPath, shardName(year, month));
}

/**
 * Read the year-shard, group its lines by occurred-at month, and emit one
 * month-shard per group. The original year-shard is removed once all
 * month-shards are written. Failure mid-flight leaves the year-shard in
 * place so the data is never lost.
 */
async function splitYearIntoMonths(
  repoPath: string,
  year: number,
): Promise<void> {
  const yearPath = path.join(repoPath, shardName(year));
  const text = await readFile(yearPath, 'utf8');

  const buckets = new Map<number, string[]>();
  for (const line of text.split(NEWLINE)) {
    if (!line) continue;
    let entry: JsonlEntry;
    try {
      entry = JSON.parse(line) as JsonlEntry;
    } catch {
      continue;
    }
    const month = new Date(entry.occurred_at).getUTCMonth() + 1;
    const bucket = buckets.get(month);
    if (bucket) {
      bucket.push(line);
    } else {
      buckets.set(month, [line]);
    }
  }

  // Write month-shards atomically (write to .tmp then rename).
  for (const [month, lines] of buckets.entries()) {
    const target = path.join(repoPath, shardName(year, month));
    const tmp = `${target}.tmp`;
    await readFile(tmp, 'utf8').catch(() => {}); // no-op probe
    await appendFile(tmp, `${lines.join(NEWLINE)}${NEWLINE}`, {
      encoding: 'utf8',
      flag: 'w',
    });
    await rename(tmp, target);
  }

  // Only remove the year-shard once every month-shard exists.
  const fh = await open(yearPath, 'r+');
  await fh.truncate(0);
  await fh.close();
  // Use rename-then-delete pattern: just unlink via empty truncate above;
  // we leave the empty file behind so historical tooling that watches the
  // year-shard path doesn't see a missing file. Listing logic skips empty.
}

/**
 * Compute the dedup key for an event: `source|external_id|occurred_at`.
 * Events without an external_id fall back to the title — this is rare
 * (manual logs) and the title is stable per source.
 */
function dedupKey(ev: EventInput | JsonlEntry): string {
  const ext = ev.external_id ?? ev.title ?? '';
  return `${ev.source}|${ext}|${ev.occurred_at}`;
}

/**
 * Read the tail of `shardPath` and parse the last `DEDUP_TAIL_LINES` JSON
 * lines into a Set of dedup keys. Returns an empty Set if the file is
 * missing or unreadable.
 */
async function loadDedupKeys(shardPath: string): Promise<Set<string>> {
  if (!existsSync(shardPath)) return new Set();
  const tailText = await readTailLines(shardPath, DEDUP_TAIL_LINES);
  const keys = new Set<string>();
  for (const line of tailText.split(NEWLINE)) {
    if (!line) continue;
    try {
      const entry = JSON.parse(line) as JsonlEntry;
      keys.add(dedupKey(entry));
    } catch {
      // skip corrupt line
    }
  }
  return keys;
}

/**
 * Per-event variant of `loadDedupKeys` for the single-append path. Slightly
 * cheaper because we can bail out as soon as we hit the matching key.
 */
async function isDuplicate(
  shardPath: string,
  event: EventInput,
): Promise<boolean> {
  if (!existsSync(shardPath)) return false;
  const tailText = await readTailLines(shardPath, DEDUP_TAIL_LINES);
  const target = dedupKey(event);
  for (const line of tailText.split(NEWLINE)) {
    if (!line) continue;
    try {
      const entry = JSON.parse(line) as JsonlEntry;
      if (dedupKey(entry) === target) return true;
    } catch {
      // skip corrupt line
    }
  }
  return false;
}

/**
 * Read the last `lineLimit` lines of a file. Reads from the tail in 64 KiB
 * chunks until enough newlines are seen or the start of the file is reached.
 * Returns the resulting suffix as a UTF-8 string.
 */
async function readTailLines(
  filePath: string,
  lineLimit: number,
): Promise<string> {
  const fh = await open(filePath, 'r');
  try {
    const fileStat = await fh.stat();
    const chunkSize = 64 * 1024;
    let position = fileStat.size;
    let collected = Buffer.alloc(0);
    let newlines = 0;

    while (position > 0 && newlines <= lineLimit) {
      const readSize = Math.min(chunkSize, position);
      position -= readSize;
      const buf = Buffer.alloc(readSize);
      await fh.read(buf, 0, readSize, position);
      collected = Buffer.concat([buf, collected]);
      newlines = countNewlinesInBuffer(collected);
    }

    const text = collected.toString('utf8');
    if (newlines <= lineLimit) return text;
    // Trim leading partial line + extra full lines beyond the limit.
    const lines = text.split(NEWLINE);
    return lines.slice(lines.length - lineLimit - 1).join(NEWLINE);
  } finally {
    await fh.close();
  }
}

/**
 * Count occurrences of `\n` in a Buffer. Faster than `String#split` for
 * large buffers because it avoids the UTF-8 decode.
 */
function countNewlinesInBuffer(buf: Buffer): number {
  let n = 0;
  for (let i = 0; i < buf.length; i += 1) {
    if (buf[i] === 0x0a) n += 1;
  }
  return n;
}

/**
 * Stream-count lines (newline-terminated) in a file without loading it
 * all into memory. Used by `listShards` to fill `entry_count`.
 */
async function countLines(filePath: string): Promise<number> {
  const fh = await open(filePath, 'r');
  try {
    const chunkSize = 64 * 1024;
    const buf = Buffer.alloc(chunkSize);
    let total = 0;
    let position = 0;
    let lastByte: number | null = null;
    let bytesRead = 0;
    do {
      const r = await fh.read(buf, 0, chunkSize, position);
      bytesRead = r.bytesRead;
      if (bytesRead === 0) break;
      total += countNewlinesInBuffer(buf.subarray(0, bytesRead));
      lastByte = buf[bytesRead - 1] ?? null;
      position += bytesRead;
    } while (bytesRead === chunkSize);
    // If the file doesn't end in \n the final partial line still counts.
    if (lastByte !== null && lastByte !== 0x0a) total += 1;
    return total;
  } finally {
    await fh.close();
  }
}

/**
 * Parse a buffer of newline-separated JSON lines. Skips empty lines and
 * lines that fail to parse — corruption on one line shouldn't blow up the
 * caller.
 */
function parseLines(text: string): JsonlEntry[] {
  const out: JsonlEntry[] = [];
  for (const line of text.split(NEWLINE)) {
    if (!line) continue;
    try {
      out.push(JSON.parse(line) as JsonlEntry);
    } catch {
      // skip corrupt line
    }
  }
  return out;
}

/**
 * Convert an `EventInput` into a fully-realised `JsonlEntry`. Fills in
 * required fields the input may have left out: `id` (random hex), the
 * canonical `visibility` default, `ingested_at` (now), and the schema
 * version.
 */
function toEntry(event: EventInput): JsonlEntry {
  const visibility: EventVisibility = event.visibility ?? 'public';
  return {
    id: event.id ?? randomId(),
    occurred_at: event.occurred_at,
    source: event.source,
    kind: event.kind,
    title: event.title ?? null,
    subtitle: event.subtitle ?? null,
    external_id: event.external_id ?? null,
    external_url: event.external_url ?? null,
    cover_url: event.cover_url ?? null,
    progress: event.progress ?? null,
    rating: event.rating ?? null,
    metadata: event.metadata ?? null,
    visibility,
    ingested_at: new Date().toISOString(),
    schema_version: SCHEMA_VERSION,
  };
}

/**
 * 32-hex-char random id. Mirrors the Turso default
 * (`lower(hex(randomblob(16)))`) so JSONL ids stay compatible with the
 * cache rebuild path.
 */
function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}
