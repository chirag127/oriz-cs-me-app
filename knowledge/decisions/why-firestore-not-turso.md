---
type: decision
title: "[SUPERSEDED] Why Firestore (not Turso/Postgres/SQLite) for events"
description: "SUPERSEDED 2026-06-19 by 100-year-strategy.md. Kept as historical context. Do NOT follow this doc's conclusions."
tags: [decision, firestore, infra, superseded]
timestamp: 2026-06-19T00:00:00Z
---

> **⚠ SUPERSEDED 2026-06-19** by [`100-year-strategy.md`](./100-year-strategy.md).
> The new strategy is: **canonical = JSONL in a git repo
> (`chirag127/oriz-me-data`); Turso is the warm cache rebuilt from git;
> Firestore stays for non-event data (auth, chat, mutable user state).**
> Do not follow this doc's conclusions. It is preserved only as a record
> of the prior reasoning.

# Decision: Firestore for events, not Turso

## Status

Locked. Use Firestore for any new event-style data (page views, AI queries,
unknown queries, visitor records, feedback, journal, …).

## Context

There was a recurring "should we add a relational events table?" idea — Turso
(libSQL) was the candidate because its free tier is generous and the queries
would be SQL. But:

- Firestore was already configured (see
  [`integrations/firestore.md`](../integrations/firestore.md)).
- Auth, chat, journal, and AI history all already write to Firestore.
- `firestore.rules` already enforces the user/admin model
  ([`architecture/auth.md`](../architecture/auth.md)).
- Adding Turso would mean:
  - A second DB credential to manage.
  - A second client SDK in the bundle.
  - A second security model (Turso doesn't have client-side rules; everything
    needs a server-side proxy).
  - Cross-DB transactions impossible.

## Decision

Use Firestore. The existing collections handle the use cases:

- Page views → `analytics/{id}` (admin-only read).
- AI queries → `aiQueries/{id}`.
- Unknown queries (when AI can't answer) → `unknownQueries/{id}`.
- Visitor records → `visitors/{id}`.
- Feedback → `feedback/{id}`.

When a new event type appears, add a collection with rules in
`firestore.rules`, not a new database.

## Consequences

- **One auth boundary.** Firebase token works everywhere.
- **One bundle cost.** Firestore SDK is already shipped; no new bytes.
- **Trade-off: SQL-shaped queries are awkward.** Firestore is document-oriented;
  ad-hoc analytics over millions of events would need exporting to BigQuery.
  We're nowhere near that scale.

## When to revisit

If admin analytics queries become more than `where userId == X order by date desc`
(joins, group-by aggregates over time windows), revisit. Until then, this
decision holds.

## See also

- [`integrations/firestore.md`](../integrations/firestore.md)
- [`architecture/auth.md`](../architecture/auth.md)
- [`architecture/data-flow.md`](../architecture/data-flow.md)
