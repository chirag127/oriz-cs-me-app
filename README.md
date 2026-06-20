# Chirag Singhal — Personal Website

Personal digital identity platform for Chirag Singhal, Software Engineer at TCS.

**Live:** [me.oriz.in](https://me.oriz.in)

## Tech Stack
- **Framework:** Astro 6 + React 19 (Islands Architecture)
- **Styling:** Tailwind CSS 4.2
- **Auth & DB:** Firebase 12 (Auth + Firestore)
- **AI:** Puter.js (free, no API keys)
- **Email:** EmailJS (contact alerts)
- **Hosting:** Cloudflare Pages (free)

## Pages
| Path | Content |
|------|---------|
| `/` | Homepage — hero, stats, projects, skills, articles |
| `/me` | Personal — story, philosophy, journal, interests, gear, finance |
| `/work` | Career — timeline, skills, projects, education, certifications |
| `/code` | Coding — GitHub analytics, LeetCode, repos |
| `/library` | Media — movies, anime, books, music |
| `/gaming` | Chess (Lichess), game tracking |
| `/connect` | Social profiles, contact |
| `/system` | Settings, changelog, admin |

## Features
- 🤖 AI Assistant (asks about Chirag)
- 🔐 Firebase Auth (Google + email/password)
- 💬 Chat with Firestore storage
- ✉️ Email alerts when AI can't answer
- 🔍 Command palette (⌘K)
- 🌙 Dark mode
- 📱 Responsive

## Setup
```bash
npm install
cp .env.example .env   # Fill Firebase + EmailJS values
npm run dev
```

## Environment Variables
See `.env.example` — Firebase config, EmailJS keys.

## Deploy
Cloudflare Pages: `npm run build` → deploy `dist/`

## Survival layers

Per [`100-year-strategy`](../../../knowledge/sites/oriz-me/decisions/100-year-strategy.md) (in the family bundle)
§16, the site has two layers that survive even if everything else dies:

| Layer                | URL                                                                 | What it has                                                                          |
| -------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Rendered mirror**  | [chirag127.github.io/oriz-me](https://chirag127.github.io/oriz-me/) | Static `/work` + `/me` + legal pages. No DB, no auth, no chat. Recruiter-grade only. |
| **Canonical archive**| [github.com/chirag127/oriz-me-data](https://github.com/chirag127/oriz-me-data) | Plain JSONL shards, one event per line, sharded by year. The data is the bedrock. |

The mirror is rebuilt on every push to `main` by
[`.github/workflows/mirror-to-pages.yml`](./.github/workflows/mirror-to-pages.yml)
— it uses only the built-in `GITHUB_TOKEN`, no extra secrets, so it
keeps working as long as the GitHub account exists. The archive lives in
a separate repo so the site repo's git history stays normal-sized;
ingesters append to it via [`scripts/sync-to-data-repo.ts`](./scripts/sync-to-data-repo.ts)
(skeleton — see [`scripts/README-data-repo.md`](./scripts/README-data-repo.md)).

## Disaster recovery

> What to do if the primary site is unreachable. Run through this once a
> year on your birthday — strategy §10 calls for an annual fire drill.

### Scenario A — me.oriz.in resolves nowhere

Cloudflare Pages is down, or the DNS lapsed, or the domain registrar
forgot you. Recruiters and links from old emails 404.

1. Verify the mirror still works:
   `curl -sI https://chirag127.github.io/oriz-me/work/`
   → expect `HTTP/2 200`. The github.io URL never lapses as long as the
   GitHub account exists.
2. Update your LinkedIn / email signature / business card to point at
   the github.io URL while the primary recovers.
3. Renew the domain or fix DNS at your leisure. The mirror buys you
   weeks, not minutes.

### Scenario B — Cloudflare loses your account

Pages, R2, and the DNS-via-Cloudflare config are all gone. Far worse
than scenario A.

1. The github.io mirror still works — same first step as above.
2. The canonical lifestream archive is untouched at
   `github.com/chirag127/oriz-me-data`. None of the lifestream data is
   in Cloudflare; it was always a downstream cache.
3. Re-register the `oriz.in` domain at any registrar (or leave it dead
   and rely on the github.io URL forever — that's a valid choice).
4. Re-deploy `dist/` to any free static host (Netlify, Surge, Vercel,
   another Cloudflare account). The build is the same `pnpm build`.
5. Re-create the Turso DB if you want the live freshness panel back,
   then run the cache-rebuild pipeline against the JSONL archive.

### Scenario C — you lose your laptop

No local clone, no SSH keys, no env files. Working from a fresh machine.

1. `gh auth login` from the new laptop.
2. `git clone https://github.com/chirag127/oriz-me.git`.
3. `git clone https://github.com/chirag127/oriz-me-data.git` next to it.
4. `pnpm install` in `oriz-me/`. The build works without env vars — the
   chat and auth features just degrade silently.
5. Recover env files from your password manager (1Password, Bitwarden,
   wherever the prod secrets live). If those are gone too, the site
   still builds and serves; only the live integrations break.
6. Push to GitHub. The mirror workflow redeploys the github.io copy
   automatically.

### Scenario D — GitHub is gone

No realistic recovery path within the strategy budget. If GitHub itself
goes away, the recovery is a manual `git push` to whatever VCS host
exists in 2076 — the JSONL archive was always plain text, so it's
trivially portable. Per strategy §13 self-hosting is out of scope; the
plan in this case is "find the next free git host and start over."
