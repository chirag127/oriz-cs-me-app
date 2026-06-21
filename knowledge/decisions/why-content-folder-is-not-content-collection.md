---
type: decision
title: Why src/content/ is NOT an Astro content collection
description: src/content/ is used as a regular folder. No config.ts exists; this works only as long as none is added.
tags: [decision, astro, content, gotcha]
timestamp: 2026-06-19T00:00:00Z
---

# Decision: src/content/ is a regular folder, not an Astro content collection

## Status

Locked. **Do not** create `src/content/config.ts` without reading this page first.

## Context

Astro reserves `src/content/` for [content collections](https://docs.astro.build/en/guides/content-collections/).
When `src/content/config.ts` exists, Astro:

- Crawls subdirectories looking for entries matching the schemas defined there.
- Refuses to start the dev server on schema mismatch.
- Generates types from the schemas.
- Imposes a specific filename convention (`slug.{md,mdx,…}`).

But this repo uses `src/content/` as a *plain folder* containing:

- `src/content/authored/*.json` — manually-edited JSON for resume, projects, social, etc.
- `src/content/generated/*.json` — API-fetched JSON from the daily/weekly sync jobs.
- `src/content/schemas/*.schema.json` — JSON Schemas validated by `scripts/validate-content.ts` (using Ajv).

This works **because no `config.ts` exists**. Astro treats the folder as
inert and import statements like
`import resume from '../content/authored/resume.json'` resolve as plain JSON imports.

## Decision

Keep `src/content/` as a plain folder. **Do not introduce `src/content/config.ts`.**
If a future feature genuinely needs Astro content collections, move it to a
*different* folder (`src/collections/`, `src/posts/`, etc.) and leave
`src/content/` alone.

## Consequences

- **Forker simplicity wins.** Authored data stays as JSON files anyone can edit
  in a text editor — no Astro/Zod schema knowledge required.
- **Validation is explicit.** `pnpm run validate-content` runs Ajv against the
  JSON Schemas in `src/content/schemas/`, decoupled from Astro's build.
- **Type safety is partial.** No auto-generated types from collections; types
  are hand-maintained where needed.

## What would break this

Adding `src/content/config.ts` (even an empty one) would make Astro treat the
folder as a content-collection root. Astro would then:

- Try to parse `src/content/authored/resume.json` as a collection entry and
  fail (no matching schema).
- Reject the dev server start.

Anyone who wants content collections later **must** read this decision first
and either rename the folder or remove the existing files from collection scope.

## See also

- [`architecture/data-flow.md`](../architecture/data-flow.md) — how the JSON files are used
- [`sources/rebuild-plan.md`](../sources/rebuild-plan.md) — Phase 1 data layout migration
