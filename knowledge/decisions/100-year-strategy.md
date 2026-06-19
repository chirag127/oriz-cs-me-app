---
type: decision
title: "100-year strategy for me.oriz.in"
description: "The contract every architecture decision for this site references. Sets durability horizon, audience priority, public/private line, daily-effort budget, format, canonical-store choice, ingester contract, fallback layers."
tags: [strategy, decision, durability, lifestream]
timestamp: 2026-06-19
---

# 100-year strategy for me.oriz.in

> Status: **active contract**, decided 2026-06-19.
> Re-read annually on each birthday. The "everything public including
> journal" line is the highest-stakes commitment in this doc — that one
> in particular gets a hard re-evaluation each year.

## Why this doc exists

This site is not a project. It is a 50-year archive. The default
architecture decisions for a project (pick the trendiest framework, ship
fast, refactor later) actively harm a 50-year archive. This doc fixes
the strategic constraints up front so every later "should I use X?"
question has an answer.

If a future architecture decision conflicts with anything below, the
strategy wins — the architecture must change. Update THIS doc only with
explicit user re-decision.

---

## The 16 decisions

### 1. Time horizon: 50 years

Data must remain readable, queryable, and ours through 2076 (when
Chirag is 70). Hardware will turn over 5–10 times. Most cloud providers
trusted today will be gone, renamed, acquired, or repriced. The format
must survive this.

### 2. On death: public archive + executor

When Chirag dies, everything public stays public forever. A literary
executor named in a will inherits write access. The site continues to
run on a paid-once-forever endowment (R2 + a domain registered for 10y
at a time). No data goes private posthumously.

### 3. Daily effort: 10 minutes is the budget

10 minutes/day is the sustainable ceiling. The journaling and
curation **practice itself** is the point — not just the artifact.
Anything that requires more than 10 min/day on average will be cut.

### 4. Top failure modes (all 3 matter)

The fears, in priority order:

- **Provider death** — Turso shuts down, Firestore reprices,
  Cloudflare deprecates Pages. Mitigated by §10.
- **Format obsolescence** — JSON-LD goes the way of XML+RDF.
  Mitigated by §11.
- **Engagement death** — Chirag loses interest, ingesters go stale,
  the site rots. Mitigated by §13–§16.

### 5. Audience priority: recruiter → collaborator → future-me

Tier 1 is hiring managers and recruiters. The home page's job is to
convert a 2-minute recruiter scroll into a callback. Tier 2 is
technical collaborators. Tier 3 is future-Chirag and biographers.

This means:
- The home page leads with `/work` + `/code` + recent shipped things.
- Lifestream (chess, books, music) is a secondary page, not the
  homepage hero.
- Inner-life content is ALSO public (per §6) but is on its own page
  rather than the front door.

### 6. Public/private line: revised — journal moves OUT, age-gates in

**The public site (me.oriz.in) does NOT publish journal entries.** The journal stays
at `journal.oriz.in` (auth-gated by Firebase). me.oriz.in's `/me` section may
surface NUMERIC aggregates from the journal API (entry count, streak, average
length per month) but never the entry text.

Rationale: the journal contains personal, often unfiltered content that doesn't
serve the recruiter audience and creates real career risk. Publishing it
publicly was a thesis-level overreach. Numeric aggregates preserve the
"I keep a journal" signal without leaking content.

**Some content sections are age-gated** (movies, anime, possibly others). When
a tracked item carries adult-content metadata, the page rendering it goes behind
an 18+ confirmation gate. See [`age-gating-policy.md`](./age-gating-policy.md).

Public/private/gated tiers, in full:

- **Public (default)** — career, code, books, music, fitness aggregates, places
  (city-level), code commits, manual logs marked safe-for-work.
- **Age-gated 18+** — film/anime/manga/game entries with adult-content flag.
  Visible only after the visitor confirms 18+ via the AgeGate component.
- **Aggregates only** — journal (count + streak + monthly word count, never
  text). Inner-life metrics (sleep, mood, weekly only).
- **Hidden** — raw GPS, exact timestamps below day-granularity, raw heart
  rate, anything tagged `private` in the canonical store.

Re-read this section every birthday. The age-gate policy in particular should
be reviewed against current jurisdictional rules — UK Online Safety Act / EU
DSA / India's IT Rules — annually.

### 7. Negative data: publish with framing

Failed projects, unfinished books, low chess ratings, gaps in commits
all get published — but with one-line commentary that contextualises.
Honesty + curation, not raw ledger dump.

### 8. Freshness: live build manifest, staleness visible

Every page chrome shows "synced 03:07Z today" with a pulsing dot.
When ingesters break, the timestamp goes stale and visitors see it.
Forces fixes, builds trust. This is the v2 design brief's signature
element and it is non-negotiable.

### 9. Maintenance budget: 7-day fix-or-pause SLA

When an ingester breaks:
- Day 0–7: I have a week to fix it.
- Day 7+: it auto-pauses. The status page surfaces a red dot for
  that source. The rest of the site keeps working.
- An ingester that auto-pauses 3 times in a year gets a hard re-eval
  — fix the root cause or remove the source from the site.

### 10. Canonical store: git repo of plain files

Canonical = `chirag127/oriz-me-data` (separate repo, public).
Cloud DBs (Turso, Firestore) are CACHES rebuilt from the git repo on
every deploy. If GitHub dies, `git clone` to a new host. If Turso dies,
rebuild the cache from git. ZERO vendor format risk.

This contradicts the prior `why-firestore-not-turso.md` decision —
that doc is now superseded by this one.

### 11. File format: JSONL sharded by year, optimised for git history size

Constraint: minimise long-term `.git` size + minimise per-commit diff
churn. This rules out:
- ❌ One file per event (millions of tiny files → git index bloat)
- ❌ Single huge JSON array (every commit rewrites the whole file)
- ❌ SQLite committed to git (binary, every commit re-stores whole file)
- ❌ Parquet (binary, same problem)

Decided: **JSONL, one file per year** (`events-2026.jsonl`). New events
APPEND to the current year-file. Git's pack format handles append-only
text near-optimally.

If a year-file passes 10 MB pre-compression, shard further into
month-files (`events-2026-06.jsonl`).

A header file (`schema.json`) declares the line schema; old years'
files specify their own schema-version field so a 2076 reader can
parse a 2026 line correctly.

### 12. Domain durability: mirror to many hosts

Strategy: deploy `me.oriz.in` to many free-subdomain hosts in parallel
(Cloudflare Pages, GitHub Pages, Netlify, Vercel, Surge, Pages.dev,
fly.io static, etc) so if one provider dies, others still resolve.

`chirag127.github.io` is the durable fallback URL — even if every
custom domain lapses, it remains free forever as long as the GitHub
account exists.

Status: **deferred to a separate decision turn**. It's a real engineering
sub-project (4–8 hours + ongoing maintenance) and conflicts with our
parked-secrets discussion. For now: oriz.in primary, github.io as the
known-good fallback URL. Multi-host mirroring scheduled for later.

### 13. Self-hostable: no, cloud-only

Architecture is cloud-only. If providers consolidate or reprice in
2055, migrate to whatever has a free tier then. Self-hosting is not
a goal.

This means **portability between clouds matters more than
self-hostability**. Every cloud-specific feature used must have a
clear cross-cloud equivalent identified in advance.

### 14. Ingester automation: 100% automated or it doesn't ship

Manual entry is allowed only for the `/log` form (paper books,
in-person experiences, things that cannot be automated). Every other
source MUST have an API webhook, scheduled poll, or periodic export
that runs without user action.

If a source can't be automated, it doesn't go on the site.

### 15. Self-healing during long absences

System must run for 6 months without my touch:
- Ingesters keep running on cron.
- API backfill (where supported) catches up gaps when I return.
- Status page shows what survived and what didn't, honestly.

Implementation contract for every ingester:
- Idempotent writes (per-source dedup key on every event).
- Auto-pause after 7d of consecutive failures (not retry forever).
- Use the upstream's full-history endpoint on first run after a gap,
  not just the recent-events endpoint, when available.
- On unrecoverable failure, write a row to the `sources` table with
  the last-error text, surface on `/status`.

### 16. Minimum-survival layer

If everything dies: what still works?
- **Static `/work` + `/me`** rendered to GitHub Pages mirror
  (`chirag127.github.io/oriz-me`). Recruiters can still find Chirag.
- **Raw JSONL on GitHub** (`chirag127/oriz-me-data`). Anyone who
  knows the repo can git clone the entire archive. The data is the
  bedrock.

These two layers are independent of every other piece of
infrastructure. They survive even if me.oriz.in resolves nowhere.

---

## What this means for the existing scaffolding

The lifestream scaffolding committed in `src/lib/lifestream/{types,db,upsert}.ts`
+ `functions/api/_helpers/turso.ts` (commit `0e5962a`) was written
assuming Turso-as-canonical. Per §10 + §11 above, that assumption is
overturned: **canonical is JSONL in git, Turso is the warm-cache layer
rebuilt from JSONL**.

The existing files don't get deleted — most of the type definitions
and the libSQL client work for Turso-as-cache. They get rewritten so:

- A new `src/lib/lifestream/jsonl.ts` reads + writes the canonical
  JSONL files (server-side: `fs/promises`; client-side: never — the
  client only ever reads the cache).
- `src/lib/lifestream/db.ts` becomes the cache-only path (Turso reads
  + Firestore reads for non-event data).
- A new `scripts/rebuild-cache.ts` reads the JSONL repo and pushes
  into the Turso `events` table. This runs in the daily GitHub Action.
- The deploy is: (1) ingesters append to JSONL repo, (2) on a fresh
  deploy, GH Action clones the JSONL repo + rebuilds the Turso cache,
  (3) the Astro build reads the cache for static page generation,
  (4) live data on the home page hits Turso through the read-only
  token at request time, edge-cached 60s.

That work is task `S2 — Pivot lifestream to git-canonical JSONL`.

---

## Annual review checklist

On Chirag's birthday each year:

- [ ] Re-read §6 (everything public including journal) — does it still fit?
- [ ] Audit which ingesters auto-paused this year. Remove ones that
      hit the limit 3+ times.
- [ ] Run the GitHub Pages mirror fire drill: confirm
      `chirag127.github.io/oriz-me` still serves a working `/work` page.
- [ ] Run the JSONL repo fire drill: clone it on a fresh machine and
      grep the data. If it's unreadable for any reason, that's an
      emergency.
- [ ] Re-read this whole doc. Update if life or career has shifted.
- [ ] Re-read [`age-gating-policy.md`](./age-gating-policy.md) against current
      jurisdictional rules (UK OSA / EU DSA / India IT Rules / etc).
- [ ] Audit which sources have ever been age-gated — confirm the gate is still
      doing its job and not over- or under-blocking.

---

## Cross-references

- Site v2 design brief: [`design-briefs/oriz-me.md`](../../../../design-briefs/oriz-me.md)
- Family rules: [`design-briefs/_FAMILY-RULES.md`](../../../../design-briefs/_FAMILY-RULES.md)
- Superseded predecessor: [`why-firestore-not-turso.md`](./why-firestore-not-turso.md) (still
  in repo as historical context — do not follow its conclusions)
- Age-gating policy: [`age-gating-policy.md`](./age-gating-policy.md) — when content
  requires an 18+ gate and how the site implements it.
- Ingester contract: [`ingester-contract.md`](./ingester-contract.md) — every
  ingester must satisfy this for the 7-day fix-or-pause SLA to work.
