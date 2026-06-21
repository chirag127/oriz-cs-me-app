---
type: integration
title: Firestore — collections and security policy
description: NoSQL DB for auth, chat, journal, AI history. media/{key} is the only public-read collection.
resource: firestore.rules
tags: [integration, firebase, firestore, database]
timestamp: 2026-06-19T00:00:00Z
---

# Firestore

Project: `chirag-127`. Used for user-scoped data (auth, chat, journal) and a
single public-read collection (`media/{key}`) that mirrors the
`src/content/generated/*.json` snapshot for live reads.

See [`architecture/data-flow.md`](../architecture/data-flow.md) for how data
gets in; see [`architecture/auth.md`](../architecture/auth.md) for the auth
model.

## Project config

```
projectId: chirag-127
authDomain: chirag-127.firebaseapp.com
```

The Firebase Web config is hardcoded in `src/lib/firebase.ts` (it's public —
the API key in Web SDK is not a secret; security is enforced by rules).
Server-side admin operations use the Firebase Admin SDK with credentials from
`FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` env vars.

## Collection inventory

From `firestore.rules` (the canonical source of truth — read it directly when
in doubt):

| Collection | Read | Write |
| --- | --- | --- |
| `users/{uid}` | owner or admin | owner (validated payload) |
| `userSettings/{uid}` | owner or admin | owner (validated payload) |
| `chatMessages/{id}` | signed-in | owner; admin can update/delete any |
| `chatSessions/{id}` | owner or admin | owner |
| `journalEntries/{id}` | owner or admin | owner; admin can delete |
| `userData/{uid}` | owner or admin | owner; admin can delete |
| `userPreferences/{uid}` | owner or admin | owner |
| `notifications/{id}` | owner or admin | owner (validated payload) |
| `admin/{id}` | admin only | admin only |
| `analytics/{id}` | admin only | denied for clients |
| `aiChats/{id}` | own or admin | signed-in to create; own to update; admin all |
| `aiQueries/{id}` | admin | signed-in to create; admin all |
| `unknownQueries/{id}` | admin | signed-in to create; admin all |
| `visitors/{id}` | admin | signed-in; own update only |
| `feedback/{id}` | admin | signed-in to create |
| `media/{categoryId}` | **anyone** | admin only |
| anything else | denied | denied |

## media/{categoryId} — the public collection

Used by the runtime API surface. Each `categoryId` corresponds to one
generated section (`movies`, `books`, `music`, `anime`, `gaming`, `coding`,
`social`, …).

Quality-gate writes flow into here from `scripts/lib/quality-gate.ts`. Weekly
snapshots commit `media/<key>` → `src/content/generated/<key>.json` so the
repo carries a current copy.

## Validation helpers

Several `isValid*` functions in the rules constrain payload shape:
- `isValidUserData` — userId/email/name length.
- `isValidChatMessage` — message ≤ 10 000 chars.
- `isValidChatSession` — title ≤ 200; messages is a list.
- `isValidJournalEntry` — text ≤ 50 000 chars.
- `isValidUserSettings` — typed flags (notifications/theme/language).

When the client schema changes, update both the validator in the rules **and**
the corresponding TypeScript type in `src/lib/firebase.ts`.

## Admin emails

Admin gating is duplicated in [`architecture/auth.md`](../architecture/auth.md).
The two emails (`whyiswhen@gmail.com`, `chirag127.in@gmail.com`) must match
between `firestore.rules` and `src/lib/firebase.ts`.

## See also

- [`architecture/auth.md`](../architecture/auth.md)
- [`architecture/data-flow.md`](../architecture/data-flow.md)
- [`decisions/why-firestore-not-turso.md`](../decisions/why-firestore-not-turso.md)
- [`runbooks/refresh-firestore-data.md`](../runbooks/refresh-firestore-data.md)
