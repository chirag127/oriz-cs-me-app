---
type: runbook
title: Deploy to Cloudflare Pages
description: Build dist/ and deploy with wrangler. Manual deploys are the canonical path; CI is for verification.
tags: [runbook, deploy, cloudflare, wrangler]
timestamp: 2026-06-19T00:00:00Z
---

# Runbook: Deploy to Cloudflare Pages

> Per the root [`AGENTS.md`](../../AGENTS.md): manual deploys are the canonical
> path. CI is kept as-is but **not relied on** for production deploys.

## Preconditions

- `wrangler` is installed (locally via `pnpm` or globally).
- You're authenticated: `wrangler login` (one-time interactive).
- `wrangler.toml` is present at repo root with `name = "chirag127"` and
  `pages_build_output_dir = "dist"`.

## Steps

```bash
# 1. Make sure authored content is up to date (optional — pulls from src/content/)
pnpm install --frozen-lockfile

# 2. Build the site (runs prebuild → mirror-content + generate-og + astro build)
pnpm run build

# 3. Verify dist/ exists and has reasonable contents
ls dist/

# 4. Deploy
wrangler pages deploy dist/ --project-name chirag127
```

## What `pnpm run build` does

1. `prebuild`: `tsx scripts/mirror-content.ts && tsx scripts/generate-og-images.ts`
   - Mirrors `src/content/authored/*.json` and `src/content/generated/*.json`
     to `public/data/*.json` so the static site has the `/data/*.json` API.
   - Generates OG share images (Vercel og + satori).
2. `astro build`: produces `dist/` with hashed assets.

See [`architecture/data-flow.md`](../architecture/data-flow.md) for the full pipeline.

## Verification

After deploy:

1. Wrangler prints a `https://<hash>.chirag127.pages.dev` URL — open it.
2. Check the homepage hero, the sidebar, and one tracker page.
3. Hit `/data/coding.json` to confirm the static API surface deployed.
4. The custom domain me.oriz.in is mapped via Cloudflare; production builds
   appear there within ~30 s.

## Rollback

```bash
wrangler pages deployment list --project-name chirag127
# Promote an older deployment via the Cloudflare dashboard
# (wrangler doesn't have a direct revert command).
```

## Common failures

| Symptom | Cause | Fix |
| --- | --- | --- |
| `wrangler pages deploy` hangs at "Authenticating" | First-time login on this machine | Run `wrangler login` interactively |
| Build OK locally, missing data on prod | `src/content/generated/*.json` is stale | Run `pnpm run fetch-data` with `.env.local` populated, then commit |
| 404 on `/data/foo.json` | Forgot the `mirror-content.ts` step | Run `pnpm run mirror-content` and rebuild |
| OG images broken | `generate-og-images.ts` errored silently | Run it standalone: `pnpm run generate-og` |

## See also

- [`architecture/data-flow.md`](../architecture/data-flow.md)
- [`refresh-firestore-data.md`](refresh-firestore-data.md)
- Root [`AGENTS.md`](../../AGENTS.md) — Phase 11 deployment strategy
