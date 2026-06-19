/**
 * Turso (libSQL) client singletons — the WARM-CACHE layer for lifestream.
 *
 * Per the 100-year-strategy decision (§10), Turso is NOT canonical. The
 * authoritative store is plain JSONL files in chirag127/oriz-me-data
 * (managed via `src/lib/lifestream/jsonl.ts`). Turso exists purely as a
 * query-optimised cache so the live edge layer can serve the last ~24 h
 * of events fast; if Turso disappears, the cache is rebuilt from
 * `git clone` of the JSONL repo on the next deploy.
 *
 * Two roles, two tokens:
 *
 * - `read` — backed by TURSO_AUTH_TOKEN_READ. Browser-safe (the token itself
 *   is read-only and gated to the `events_public` view). Used in Astro
 *   server-rendered pages and from islands that need to query directly.
 *   This is the high-traffic path: every Pages Function read goes here.
 * - `cache-rebuild` (formerly `write`) — backed by TURSO_AUTH_TOKEN_WRITE.
 *   SERVER-ONLY. Used EXCLUSIVELY by the rebuild-cache pipeline that
 *   reads JSONL shards and re-populates the `events` table on every
 *   deploy. Direct ingest workers MUST NOT use this — they append to
 *   JSONL via `jsonl.ts` instead, and the cache rebuild picks up the
 *   change on the next scheduled run. Never imported into a client island;
 *   never exposed as a `PUBLIC_*` env.
 *
 * The clients are memoised per-role so repeated `getClient(...)` calls inside
 * a single request reuse one socket. The separate `clearClients()` helper
 * exists for HMR + tests.
 *
 * Astro env-var convention: anything readable in the browser bundle must be
 * prefixed `PUBLIC_`. The read-only Turso token is exposed via `PUBLIC_TURSO_*`
 * because there's no risk in giving a browser a token that can only SELECT
 * from `events_public`. The write token is NEVER prefixed `PUBLIC_`.
 */

import { type Client, createClient } from '@libsql/client';

export type ClientRole = 'read' | 'write';

interface ClientCache {
  read: Client | null;
  write: Client | null;
}

const cache: ClientCache = { read: null, write: null };

/**
 * Read the Turso connection config from the appropriate env. Astro exposes
 * env on `import.meta.env`; Cloudflare Pages Functions receive env via
 * the request context (handled in `functions/api/_helpers/turso.ts`).
 *
 * This module is the Astro-side path. Pages Functions use the helper.
 */
function readEnv(role: ClientRole): { url: string; authToken: string } {
  const env = import.meta.env;
  const url =
    typeof env.PUBLIC_TURSO_DB_URL === 'string' ? env.PUBLIC_TURSO_DB_URL : '';

  const authToken =
    role === 'write'
      ? typeof env.TURSO_AUTH_TOKEN_WRITE === 'string'
        ? env.TURSO_AUTH_TOKEN_WRITE
        : ''
      : typeof env.PUBLIC_TURSO_AUTH_TOKEN_READ === 'string'
        ? env.PUBLIC_TURSO_AUTH_TOKEN_READ
        : '';

  if (!url) {
    throw new Error(
      '[lifestream/db] Missing PUBLIC_TURSO_DB_URL. Set it in .env.local or the Cloudflare Pages env.',
    );
  }
  if (!authToken) {
    const expected =
      role === 'write'
        ? 'TURSO_AUTH_TOKEN_WRITE (server-only)'
        : 'PUBLIC_TURSO_AUTH_TOKEN_READ (browser-safe, read-only)';
    throw new Error(`[lifestream/db] Missing ${expected}.`);
  }

  return { url, authToken };
}

/**
 * Get a libSQL client for the given role. Memoised per role; safe to call
 * many times in one request. The write role MUST NOT be invoked from a
 * client-side bundle — it will throw because the env var won't be defined.
 */
export function getClient(role: ClientRole = 'read'): Client {
  const cached = cache[role];
  if (cached) return cached;

  const { url, authToken } = readEnv(role);
  const client = createClient({ url, authToken });
  cache[role] = client;
  return client;
}

/**
 * Convenience accessor for read-side queries. Same as `getClient('read')`.
 */
export function getReadClient(): Client {
  return getClient('read');
}

/**
 * Convenience accessor for the cache-rebuild script. Same as
 * `getClient('write')`. Used ONLY by the JSONL → Turso rebuild pipeline
 * that runs on every deploy; ingest workers must append to JSONL via
 * `jsonl.ts` instead and let the next rebuild pick the change up.
 *
 * @throws if called from a client-side bundle that lacks TURSO_AUTH_TOKEN_WRITE.
 */
export function getCacheRebuildClient(): Client {
  return getClient('write');
}

/**
 * Drop both cached clients. Use only in HMR reload paths and test teardown.
 * Production code should never call this.
 */
export function clearClients(): void {
  cache.read = null;
  cache.write = null;
}
