/**
 * Upsert helpers for lifestream events.
 *
 * The `events` table has a `UNIQUE(source, external_id, occurred_at)`
 * constraint. We want re-imports (re-running an ingester, re-uploading a
 * Google Takeout) to be idempotent — duplicates are skipped, NOT errored.
 *
 * SQLite-flavoured `INSERT OR IGNORE` does exactly that: the row is inserted
 * if novel, silently skipped if it would violate any UNIQUE constraint.
 *
 * Both helpers below take a libSQL `Client` so the caller controls whether
 * they're using the cached singleton (`getWriteClient()` from `./db.ts`) or
 * a request-scoped client (Pages Function helper).
 */

import type { Client } from '@libsql/client';
import type { BatchUpsertResult, EventInput, UpsertResult } from './types.ts';

/**
 * Insert a single event. Returns `inserted: false` if the row was a duplicate.
 *
 * `id` and `ingested_at` and `visibility` are filled by SQL defaults if not
 * provided; pass them explicitly only when you have a reason to override.
 *
 * The `metadata` field is JSON-stringified before write. Reads are expected
 * to JSON.parse it (or use the `events_public` view that already does so on
 * Postgres-flavoured Turso instances — SQLite stores raw text).
 */
export async function upsertEvent(
  client: Client,
  event: EventInput,
): Promise<UpsertResult> {
  const result = await client.execute({
    sql: `
      INSERT OR IGNORE INTO events (
        id, occurred_at, source, kind,
        title, subtitle,
        external_id, external_url, cover_url,
        progress, rating, metadata,
        visibility
      ) VALUES (
        COALESCE(?, lower(hex(randomblob(16)))),
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        COALESCE(?, 'public')
      )
    `,
    args: [
      event.id ?? null,
      event.occurred_at,
      event.source,
      event.kind,
      event.title ?? null,
      event.subtitle ?? null,
      event.external_id ?? null,
      event.external_url ?? null,
      event.cover_url ?? null,
      event.progress ?? null,
      event.rating ?? null,
      event.metadata == null ? null : JSON.stringify(event.metadata),
      event.visibility ?? null,
    ],
  });

  // libSQL exposes `rowsAffected` — 1 means inserted, 0 means duplicate.
  const inserted = result.rowsAffected === 1;
  const lastRowId =
    result.lastInsertRowid != null ? Number(result.lastInsertRowid) : null;

  return { inserted, rowid: inserted ? lastRowId : null };
}

/**
 * Bulk upsert. Wraps the inserts in a transaction so a partial failure rolls
 * back. Returns counts of `inserted` vs `skipped` (deduped).
 *
 * Use this from ingest workers that pull a batch from an upstream API. For
 * cron-frequency calls (every 1 minute), expect batches of 0–50 events.
 *
 * Note: libSQL's `transaction()` returns a Transaction handle that must be
 * either committed or rolled back. We commit on success and roll back on any
 * thrown error.
 */
export async function batchUpsert(
  client: Client,
  events: EventInput[],
): Promise<BatchUpsertResult> {
  if (events.length === 0) return { inserted: 0, skipped: 0 };

  const tx = await client.transaction('write');
  try {
    let inserted = 0;
    for (const event of events) {
      const r = await tx.execute({
        sql: `
          INSERT OR IGNORE INTO events (
            id, occurred_at, source, kind,
            title, subtitle,
            external_id, external_url, cover_url,
            progress, rating, metadata,
            visibility
          ) VALUES (
            COALESCE(?, lower(hex(randomblob(16)))),
            ?, ?, ?,
            ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            COALESCE(?, 'public')
          )
        `,
        args: [
          event.id ?? null,
          event.occurred_at,
          event.source,
          event.kind,
          event.title ?? null,
          event.subtitle ?? null,
          event.external_id ?? null,
          event.external_url ?? null,
          event.cover_url ?? null,
          event.progress ?? null,
          event.rating ?? null,
          event.metadata == null ? null : JSON.stringify(event.metadata),
          event.visibility ?? null,
        ],
      });
      if (r.rowsAffected === 1) inserted += 1;
    }

    await tx.commit();
    return { inserted, skipped: events.length - inserted };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/**
 * Update the `sources` table after an ingest finishes. Tracks the last
 * successful sync and the last error, so the UI can render
 * "Spotify last synced 2 hours ago" / "Last.fm — error 3 hours ago".
 *
 * Pass `error: null` on success, `error: err.message` on failure. Either way
 * the row is updated (UPSERT semantics on `name`).
 */
export async function recordSyncStatus(
  client: Client,
  args: { name: string; error: string | null },
): Promise<void> {
  await client.execute({
    sql: `
      INSERT INTO sources (name, last_synced_at, last_error)
      VALUES (?, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(name) DO UPDATE SET
        last_synced_at = excluded.last_synced_at,
        last_error     = excluded.last_error
    `,
    args: [args.name, args.error],
  });
}
