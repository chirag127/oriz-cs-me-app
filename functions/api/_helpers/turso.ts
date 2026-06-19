/**
 * Turso client helper for Cloudflare Pages Functions — READ-ONLY edge layer.
 *
 * Per the 100-year-strategy decision (§10), Turso is the warm-cache for the
 * canonical JSONL store in chirag127/oriz-me-data. This helper exists so
 * Pages Functions on the live edge can serve the last ~24 h of events fast;
 * older data is read from static JSON snapshots committed to the site repo.
 *
 * The default role is `'read'` and that is what Pages Functions should use.
 * The `'write'` role is documented for completeness but is reserved for the
 * `scripts/rebuild-cache.ts` pipeline ONLY — it runs in the daily GitHub
 * Action that reads JSONL shards and re-populates the Turso `events` table.
 * Ingest workers MUST NOT call this with `'write'`; they append to JSONL
 * via `src/lib/lifestream/jsonl.ts` and let the next rebuild propagate.
 *
 * Pages Functions don't read env from `import.meta.env` — they receive it
 * as a binding on the request context (`context.env`). This module exposes
 * a helper that takes the request context and returns a libSQL client
 * configured for either read-only or (rebuild-only) write access.
 *
 * Use from any `functions/api/**` handler:
 *
 *     import { getRequestClient } from '../_helpers/turso.ts';
 *
 *     export async function onRequestGet(ctx: PagesFunctionContext) {
 *       const db = getRequestClient(ctx); // role defaults to 'read'
 *       const r = await db.execute('SELECT * FROM events_public LIMIT 50');
 *       return Response.json(r.rows);
 *     }
 *
 * Sister of `src/lib/lifestream/db.ts` — same singleton-ish API, different
 * env-source plumbing.
 */

import { type Client, createClient } from '@libsql/client';

export type ClientRole = 'read' | 'write';

/**
 * Shape of the env binding we need from Cloudflare Pages.
 *
 * `PUBLIC_TURSO_*` is the read-only token (also exposed to the browser via
 * the Astro side); `TURSO_AUTH_TOKEN_WRITE` is the server-only write token.
 *
 * Sites can extend this in their own context type if they keep more bindings.
 */
export interface TursoEnvBinding {
  PUBLIC_TURSO_DB_URL?: string;
  PUBLIC_TURSO_AUTH_TOKEN_READ?: string;
  TURSO_AUTH_TOKEN_WRITE?: string;
}

/**
 * Minimal Pages Functions context shape we actually depend on. Loose typing
 * here matches the rest of the `functions/` layer (no `@cloudflare/workers-types`
 * dependency yet) — when that's added in the cron-trigger phase, this can
 * tighten to `EventContext<TursoEnvBinding, string, unknown>`.
 */
export interface RequestCtxLike {
  env: TursoEnvBinding;
}

/**
 * Per-request memo. The Pages Functions runtime instantiates a fresh module
 * per request (warm starts may share, but we don't depend on that), so this
 * cache exists to dedupe client construction across multiple awaits inside
 * one handler. We key on the role only — both clients can coexist.
 *
 * Note: this is module-scope state. In the V8 isolate model, this leaks
 * between hot requests on the same isolate. That's intentional and safe
 * because we never mutate the client and the env doesn't change between
 * requests on the same isolate — but if you ever rotate tokens at runtime,
 * call `clearRequestCache()` on the next request after the rotation.
 */
const requestCache: { read: Client | null; write: Client | null } = {
  read: null,
  write: null,
};

/**
 * Get a Turso client scoped to the current request's environment.
 *
 * @throws if the required env binding is missing — surfaces as a 500 to the
 * caller via the surrounding handler's try/catch, which is correct: a missing
 * token is a deployment misconfiguration, not a user error.
 */
export function getRequestClient(
  ctx: RequestCtxLike,
  role: ClientRole = 'read',
): Client {
  const cached = requestCache[role];
  if (cached) return cached;

  const url = ctx.env.PUBLIC_TURSO_DB_URL;
  const authToken =
    role === 'write'
      ? ctx.env.TURSO_AUTH_TOKEN_WRITE
      : ctx.env.PUBLIC_TURSO_AUTH_TOKEN_READ;

  if (!url) {
    throw new Error(
      '[functions/turso] Missing PUBLIC_TURSO_DB_URL on the Pages env binding.',
    );
  }
  if (!authToken) {
    const expected =
      role === 'write'
        ? 'TURSO_AUTH_TOKEN_WRITE (server-only)'
        : 'PUBLIC_TURSO_AUTH_TOKEN_READ (browser-safe, read-only)';
    throw new Error(`[functions/turso] Missing ${expected}.`);
  }

  const client = createClient({ url, authToken });
  requestCache[role] = client;
  return client;
}

/**
 * Drop both cached clients on the current isolate. Use only after a token
 * rotation that the new request needs to pick up immediately.
 */
export function clearRequestCache(): void {
  requestCache.read = null;
  requestCache.write = null;
}

/**
 * Standard error response for API routes when the DB is unreachable / misconfigured.
 *
 * Use sparingly — only when the request *cannot* be served. For partial
 * failures (e.g. one upstream is down), prefer returning the data that's
 * available with a `degraded: true` flag in the body.
 */
export function dbErrorResponse(err: unknown): Response {
  const message = err instanceof Error ? err.message : String(err);
  return new Response(
    JSON.stringify({ error: 'lifestream-db-unavailable', detail: message }),
    {
      status: 503,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
}
