# `content/` — currently unused

> Per owner directive 2026-06-19 (see [`docs/QUESTIONS.md`](../docs/QUESTIONS.md#q1) Q1), this directory is **aspirational, not active**. Personal data continues to live in `src/data/*.ts` and inline in `src/pages/*.astro`. AGENTS.md's "single source of truth = content/" rule is downgraded to a future target.
>
> If you are an AI agent reading this: **do not migrate `src/data/*.ts` into `content/`.** Make changes where the data already lives. The `content/` layout below is the target shape for any greenfield collection (résumé variants, blog, journal) — not a prerequisite for landing changes elsewhere.

## Aspirational layout

If a future collection lands under `content/`, it should follow the layout AGENTS.md documents:

```text
content/
  identity.json              Name, email, role, location, taglines
  resume/base.yaml           RenderCV master data
  resume/variants/*.yaml     full / backend / ai
  career/*.mdx               One file per role
  projects/*.mdx             One file per featured project
  education/*.mdx
  certifications/*.json
  skills.json
  testimonials.json
  gear.json
  philosophy.mdx
  story.mdx
  now.mdx
  blog/*.mdx                 Blog posts (Sandpack code, mermaid, charts)
  journal/*.mdx              Public journal entries
```

When and only when that happens, each collection gets a Zod schema in `src/lib/schemas/` and `pnpm validate-content` starts doing real work.

## Today's reality

- Personal data: [`src/data/social.ts`](../src/data/social.ts), [`src/data/resume.ts`](../src/data/resume.ts), [`src/data/testimonials.ts`](../src/data/testimonials.ts).
- Shared identifiers (usernames, endpoints, location): [`src/lib/config.ts`](../src/lib/config.ts) — this remains the single source of truth for those, and that rule **is** enforced.
