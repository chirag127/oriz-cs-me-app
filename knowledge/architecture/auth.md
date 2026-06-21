---
type: architecture
title: Auth model — Firebase for data, Puter.js for AI
description: Two independent auth tracks. Firebase Google + email/pass gates Firestore writes; Puter.js gates AI features only.
resource: src/lib/firebase.ts
tags: [architecture, auth, firebase, puter]
timestamp: 2026-06-19T00:00:00Z
---

# Auth model

The site has **two independent auth tracks**. They do not share identity, do not
share session, and are required for different things. A visitor who only browses
public pages needs neither.

## Track 1: Firebase (data)

Required for: writing chat messages, user settings, AI chat
sessions persisted to Firestore.

### Providers

- **Google OAuth** via `signInWithPopup` (popup is more reliable than redirect on localhost — see comment in `src/lib/firebase.ts`).
- **Email + password** via the standard Firebase Auth flow.
- **Phone** via `RecaptchaVerifier` + `signInWithPhoneNumber` (wired but not currently surfaced in any UI).

### Persistence

`browserLocalPersistence` is set explicitly in `signInWithGoogle()`. Sign-in
holds across sessions until the user signs out.

### Admin emails

Defined in **two** places — they MUST match:

- `src/lib/firebase.ts` → `ADMIN_EMAILS = ['whyiswhen@gmail.com', 'chirag127.in@gmail.com']`
- `firestore.rules` → `isAdmin()` helper checks the same two `request.auth.token.email` values.

`isAdminEmail(email)` and `isAdmin(user)` are exported from `src/lib/firebase.ts`
for client-side admin gating (e.g. `/system/admin`).

### What signed-in users can do

See [`integrations/firestore.md`](../integrations/firestore.md) for the full
collection-level policy. Summary:

| Collection | Anonymous | Signed-in user (own docs) | Admin |
| --- | --- | --- | --- |
| `users/{uid}` | ✗ | read+write own | read all, delete |
| `chatMessages` | ✗ | read all, write own | read+write all |
| `chatSessions/{id}` | ✗ | read+write own | read+write all |
| `media/{key}` | ✓ read | ✓ read | ✓ read+write |

## Track 2: Puter.js (AI)

Required for: actually invoking the Puter AI models inside `ChatWrapper.tsx`
(the in-page assistant). Browsing the chat UI does not require Puter sign-in;
*calling a model* does.

- **Network constraint:** `js.puter.com` is loaded from the `Layout.astro`
  script tag. Networks that block puter.com (some corporate VPNs, some
  ad-blockers) silently disable AI features.
- **No API key.** Puter handles auth via its own popup; the user signs into
  Puter once and the SDK manages the token.
- The models offered are filtered to OpenRouter's `:free` tier — see
  [`integrations/open-router.md`](../integrations/open-router.md).
- See [`integrations/puter-js.md`](../integrations/puter-js.md) for the wiring.

## What we deliberately don't have

- **No SSO.** Firebase and Puter are unrelated identities.
- **No anonymous Firestore writes.** The `firestore.rules` fallback denies all
  uncovered paths.
- **No `noscript` AI fallback.** AI is JS-only by design.

## See also

- [`data-flow.md`](data-flow.md), [`integrations/firestore.md`](../integrations/firestore.md)
- [`integrations/puter-js.md`](../integrations/puter-js.md)
- [`decisions/why-firestore-not-turso.md`](../decisions/why-firestore-not-turso.md)
