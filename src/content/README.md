# `src/content/` — Single source of truth for site data

This folder is the canonical home for everything the site renders. It
replaces the old scattered layout (`src/data/*.ts` + `public/data/*.json`).

## Layout

```
src/content/
├── authored/       Hand-authored personal data. Edit these to fork the site.
│   ├── resume.json
│   ├── social.json
│   ├── testimonials.json
│   ├── uses.json
│   └── amazon.json
├── generated/      CI-fetched data. Written by scripts/fetch-data.ts;
│                   committed weekly by .github/workflows/snapshot-weekly.yml.
│   ├── movies.json, music.json, books.json, anime.json, ...
│   └── (do NOT hand-edit; quality-gate.ts will reject bad fetches)
├── schemas/        JSON Schema for every authored file (drag into VS Code
│   │              or pass to ajv for validation).
│   ├── resume.schema.json
│   └── ...
├── types.ts        TypeScript interfaces matching the schemas. Imported by
│                   pages and the barrel.
└── index.ts        Barrel — re-exports authored JSON as named symbols so
                    pages can `import { resume } from '../content'`.
```

## Public read API

The build script `scripts/mirror-content.ts` copies every file in
`authored/` into `public/data/` so they're served as
`https://me.oriz.in/data/<name>.json` for external consumers (forkers,
embeds, mobile apps). Generated data is mirrored to `public/data/` by
the fetch-data pipeline, not this script.

This runs automatically as the `prebuild` step in `package.json`. You can
also run it manually:

```bash
pnpm run mirror-content
```

## Forking checklist

1. Replace each file in `authored/` with your own data. Validate against
   the matching `schemas/<name>.schema.json` (VS Code does this
   automatically if your editor has YAML/JSON Schema support).
2. Run `pnpm run mirror-content` to regenerate `public/data/`.
3. Configure your own API tokens in `.env.local` (see `.env.example`).
4. Run `pnpm run fetch-data` once to populate `generated/`.
5. `pnpm run build` and deploy.

## Validation

A future `pnpm run validate-content` task will run ajv against every
authored file. Until then, schemas are documentation that VS Code can
turn into autocomplete via `$schema`.
