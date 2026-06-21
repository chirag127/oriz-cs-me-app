---
type: integration
title: RenderCV — YAML resume → PDF, published as GitHub Releases
description: 3 resume variants (full / backend / ai) compiled by uvx rendercv in CI.
resource: .github/workflows/build-resume.yml
tags: [integration, resume, ci, rendercv]
timestamp: 2026-06-19T00:00:00Z
---

# RenderCV

Resume hosting model: the canonical resume is **YAML** under
`src/content/authored/resume/`, and CI compiles it to PDFs that get attached to
a GitHub Release. The header's "Resume" button (see
[`components/mega-header.md`](../components/mega-header.md)) links to the
latest release asset URL.

## Three variants

| File | Audience |
| --- | --- |
| `resume/full.yaml` | Full career history |
| `resume/backend.yaml` | Backend-focused edit |
| `resume/ai.yaml` | AI/ML-focused edit |

Each variant is a separate YAML file rendered with the same RenderCV theme.
Forkers replace the YAML and ship — same pattern as authored JSON in
[`architecture/data-flow.md`](../architecture/data-flow.md).

## Workflow

`.github/workflows/build-resume.yml`:

1. Checks out the repo.
2. Installs `uv` (the `uvx rendercv` runner — no global install needed).
3. Runs `uvx rendercv render <variant>.yaml` for each variant.
4. Collects PDFs.
5. Creates a GitHub Release tagged `resume-v<sha>` and attaches the PDFs.

## Open question

Naming convention on Releases — see
[`sources/rebuild-plan.md`](../sources/rebuild-plan.md):

> `resume.pdf` (always overwrite latest) vs `resume-<variant>-v<sha>.pdf` (versioned forever)?

Not yet decided.

## See also

- [`components/mega-header.md`](../components/mega-header.md) — Resume button
- [`sources/rebuild-plan.md`](../sources/rebuild-plan.md) — Phase 2
- [`architecture/data-flow.md`](../architecture/data-flow.md)
