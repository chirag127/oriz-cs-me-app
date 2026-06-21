---
type: integration
title: Puter.js — free AI runtime, no API keys
description: SDK loaded from js.puter.com that brokers free model access. Required for AI features only.
resource: src/layouts/Layout.astro
tags: [integration, ai, puter, llm]
timestamp: 2026-06-19T00:00:00Z
---

# Puter.js

The site's AI features (in-page chat that answers questions about Chirag) run
on **Puter.js**, a third-party SDK that brokers free LLM access via the user's
own Puter account. Puter handles auth, billing, and rate-limits; the site never
touches an API key.

## Loading

The SDK is loaded via a `<script>` tag in `src/layouts/Layout.astro`:

```html
<script src="https://js.puter.com/v2/"></script>
```

This means Puter is on every page, but the SDK lies dormant until something
calls `puter.ai.chat(...)`. Only the AI assistant in `ChatWrapper.tsx` calls it.

## Auth

- Independent of Firebase. See [`architecture/auth.md`](../architecture/auth.md).
- First time the user invokes an AI call, Puter pops up its own sign-in flow.
- Subsequent calls reuse the Puter session token, managed by the SDK.

## Network constraint

`js.puter.com` is the only third-party origin required for AI features. If a
network blocks puter.com (corporate VPNs, strict ad-blockers, sandbox
environments without internet), AI silently fails. The chat UI still renders
because it doesn't depend on the SDK, only on `puter.ai.chat()`.

## Models

The chat surfaces **OpenRouter `:free` models** — see
[`integrations/open-router.md`](open-router.md). Puter is the SDK; OpenRouter
is the model catalog. The model picker is fed dynamically and refreshed daily
by `.github/workflows/refresh-models.yml`.

## Why Puter

- **Zero secrets to manage.** No API key in `.env`.
- **Forkable.** A fork of the repo doesn't need to own model access; visitors
  use their own Puter accounts.
- **Free tier.** Puter offers a generous free quota that's enough for personal
  site demos.

## Failure modes

- Puter outage → AI chat shows an error, rest of the site works.
- Network block → same UX as outage from the user's perspective.
- Visitor declines Puter sign-in → AI returns an auth error, no chat.

## See also

- [`open-router.md`](open-router.md)
- [`architecture/auth.md`](../architecture/auth.md)
- [`components/mega-header.md`](../components/mega-header.md) — entry point to chat
