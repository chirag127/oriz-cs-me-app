/**
 * Lifestream event types — the public-facing data layer for the digital twin.
 *
 * One `events` table absorbs every kind of activity (music, books, watch,
 * workouts, code commits, places, manual logs). New media types add a `kind`
 * value and stash their source-specific fields in the `metadata` JSON column.
 *
 * Schema mirror — see knowledge/runbooks/lifestream-schema.md and the
 * post-4 architecture in oriz-blog
 * (`build-your-digital-twin-public-lifestream-2026.mdx`).
 */

/**
 * Where the event came from. Keep these stable — they're persisted in the DB
 * and used as the discriminator on the unique constraint.
 *
 * Add new sources by extending this union; do NOT rename existing values.
 */
export type EventSource =
  | 'lastfm'
  | 'listenbrainz'
  | 'spotify'
  | 'simkl'
  | 'anilist'
  | 'mal'
  | 'mangadex'
  | 'openlibrary'
  | 'hardcover'
  | 'goodreads'
  | 'letterboxd'
  | 'trakt'
  | 'youtube'
  | 'fitbit'
  | 'health-connect'
  | 'strava'
  | 'github'
  | 'wakatime'
  | 'lichess'
  | 'steam'
  | 'vndb'
  | 'mastodon'
  | 'bluesky'
  | 'reddit'
  | 'raindrop'
  | 'maps-timeline'
  | 'manual';

/**
 * What kind of activity. Discriminator for per-medium pages and stats.
 *
 * `code` covers commits + PRs + issues + releases (GitHub).
 * `post` covers blog posts, social posts, and link bookmarks.
 * `place` is a downsampled location visit (city-level by default — never raw GPS in the public table).
 */
export type EventKind =
  | 'song'
  | 'movie'
  | 'episode'
  | 'book'
  | 'manga'
  | 'audiobook'
  | 'podcast'
  | 'play'
  | 'workout'
  | 'sleep'
  | 'step'
  | 'place'
  | 'code'
  | 'post';

/**
 * Visibility gate for the public site.
 *
 * - `public` — anyone can see it; `events_public` view filters to this.
 * - `unlisted` — visible only on year-in-review aggregates, not the live feed.
 * - `private` — admin-only via the Pages Function with the write token.
 *
 * Default policy lives in knowledge/decisions/visibility-defaults.md.
 */
export type EventVisibility = 'public' | 'unlisted' | 'private';

/**
 * A single lifestream event. Mirrors the SQL row but with parsed metadata.
 *
 * Persisted shape: id is a ULID (server-generated); occurred_at is the time
 * the activity actually happened (NOT when it was ingested); ingested_at is
 * filled by SQLite default CURRENT_TIMESTAMP.
 */
export interface Event {
  id: string;
  occurred_at: string;
  source: EventSource;
  kind: EventKind;
  title: string | null;
  subtitle: string | null;
  external_id: string | null;
  external_url: string | null;
  cover_url: string | null;
  progress: number | null;
  rating: number | null;
  /**
   * Source-specific JSON blob, parsed. Anything that doesn't have a column.
   * Keep this small (<2 KB per row) — large blobs go in R2, not Turso.
   */
  metadata: Record<string, unknown> | null;
  visibility: EventVisibility;
  ingested_at: string;
}

/**
 * Input shape for upserts. The DB fills `id` (ULID), `ingested_at`,
 * and `visibility` (defaults to `public`) when not provided.
 */
export interface EventInput {
  id?: string;
  occurred_at: string;
  source: EventSource;
  kind: EventKind;
  title?: string | null;
  subtitle?: string | null;
  external_id?: string | null;
  external_url?: string | null;
  cover_url?: string | null;
  progress?: number | null;
  rating?: number | null;
  metadata?: Record<string, unknown> | null;
  visibility?: EventVisibility;
}

/**
 * Per-source freshness tracking. The UI reads this to render
 * "Spotify last synced 2 hours ago" so a broken ingester is visible.
 */
export interface SourceStatus {
  name: EventSource;
  last_synced_at: string | null;
  last_error: string | null;
}

/**
 * Result of a single upsert. `inserted=false` means the row was a duplicate
 * (matched the UNIQUE(source, external_id, occurred_at) constraint).
 */
export interface UpsertResult {
  inserted: boolean;
  rowid: number | null;
}

/**
 * Result of a batch upsert. `inserted` is the count of rows that were
 * genuinely new; `skipped` is the dedup count.
 */
export interface BatchUpsertResult {
  inserted: number;
  skipped: number;
}
