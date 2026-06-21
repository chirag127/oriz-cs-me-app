---
type: integration
title: OpenRouter :free model catalog
description: Daily-refreshed list of free LLM models surfaced in the AI chat picker.
resource: .github/workflows/refresh-models.yml
tags: [integration, ai, openrouter, llm, catalog]
timestamp: 2026-06-19T00:00:00Z
---

# OpenRouter :free model catalog

The AI chat (powered by [`puter-js.md`](puter-js.md)) shows the user a list of
models to pick from. We deliberately filter to OpenRouter's `:free` tier so
no visitor incurs cost.

## Refresh cadence

`.github/workflows/refresh-models.yml` runs daily. The job:

1. Calls the OpenRouter `/api/v1/models` endpoint.
2. Filters to entries whose `id` ends in `:free`.
3. Sorts by a stability heuristic (newer + more reliable first).
4. Writes the filtered list to `src/content/generated/openrouter-free.json`
   (or wherever `mirror-content.ts` expects — see
   [`architecture/data-flow.md`](../architecture/data-flow.md)).
5. Commits + pushes.

## Why daily

OpenRouter's free tier shifts often — models get promoted off `:free`, new
ones appear, some go offline. A daily catalog refresh keeps the picker
honest without a manual step.

## Recent commits in scope

- `e89809b feat(ai): daily-refreshable OpenRouter free-model catalog`
- `fabdbeb ci: daily refresh of OpenRouter free model catalog`

## Failure mode

If the refresh job fails:
- The previous JSON snapshot is kept (the workflow doesn't overwrite on
  empty result, by design).
- The chat picker continues to show whatever models were last seen.
- The site is unaffected; only the freshness of the catalog suffers.

## See also

- [`puter-js.md`](puter-js.md)
- [`architecture/data-flow.md`](../architecture/data-flow.md)
