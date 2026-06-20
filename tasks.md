# Tasks — me.oriz.in

> 300 actionable checkboxes derived from `docs/REBUILD-PLAN.md` (Phase 1–6),
> `docs/SITE-IMPROVEMENT-REPORT.md`, `docs/DESIGN-AUDIT.md`, and the
> oriz-blog Digital Twin (post 4) lifestream architecture.
>
> **Conventions:**
> - `[P0]` blocker · `[P1]` should-have · `[P2]` nice-to-have · `[P3]` defer-able
> - Category tags: `[setup]` `[db]` `[ingest:<src>]` `[ui]` `[ops]` `[privacy]` `[ext]` `[webhook]` `[export]` `[doc]` `[ci]` `[a11y]` `[perf]` `[seo]`
> - `-> #N` = blocked by task #N
> - Journal is **kept** as a feature; reads from the future `journal.oriz.in` API instead of writing locally.
> - No iOS dependencies (Health Connect for fitness, not Apple Health).
> - Strava is paywalled; Fitbit is the fallback.
>
> **OKF wiki cross-reference:** when in doubt, see [`oriz/knowledge/sites/oriz-me/index.md`](../../../knowledge/sites/oriz-me/index.md).

---

## A. Pre-flight & deploy (10 tasks) — gate everything else

1. - [ ] [P0] [setup] Run `npx wrangler@4.66.0 login` in the terminal so a Pages-edit token is cached
2. - [ ] [P0] [setup] Verify Cloudflare Pages project `chirag127` exists with `wrangler pages project list` -> #1
3. - [ ] [P0] [setup] If project missing, create it: `wrangler pages project create chirag127 --production-branch=main` -> #2
4. - [ ] [P0] [setup] First manual deploy: `pnpm run build && wrangler pages deploy dist --project-name=chirag127` -> #3
5. - [ ] [P0] [setup] Attach custom domain `me.oriz.in` and also chirag127.in via `wrangler pages domain add chirag127 me.oriz.in` (or dashboard)
6. - [ ] [P0] [setup] Add CNAME in DNS → `chirag127.pages.dev`
7. - [ ] [P0] [setup] Verify HTTPS resolves at `https://me.oriz.in` and `chirag127` with status 200
8. - [ ] [P0] [setup] Set GitHub Actions secrets `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` so `daily-build.yml` can deploy
9. - [ ] [P1] [setup] Trigger `daily-build.yml` via `gh workflow run daily-build.yml` to verify CI deploy works end to end
10. - [ ] [P1] [doc] Document the deploy steps in [`knowledge/runbooks/deploy.md`](knowledge/runbooks/deploy.md)

---

## B. Phase 1 — Foundations (50 tasks)

### B.1 Data-layout migration cleanup (10)

11. - [ ] [P1] [setup] Confirm `src/content/{authored,generated,schemas}/` is the canonical data home (already done; verify with `ls`)
12. - [ ] [P1] [doc] Update `AGENTS.md` to point at `src/content/` not `src/data/`
13. - [ ] [P1] [setup] Delete the legacy `src/data/` directory if any traces remain
14. - [ ] [P1] [ci] Confirm `scripts/mirror-content.ts` still copies authored → public/data correctly
15. - [ ] [P1] [ci] Confirm `scripts/snapshot-weekly.yml` still pulls Firestore → src/content/generated
16. - [ ] [P2] [doc] Add a runbook `knowledge/runbooks/add-new-authored-data.md`
17. - [ ] [P2] [doc] Add a runbook `knowledge/runbooks/add-new-fetched-source.md` (extend `fetch-data.ts`)
18. - [ ] [P2] [setup] Verify all 5 schemas in `src/content/schemas/` validate via `pnpm run validate-content`
19. - [ ] [P2] [ci] Add `pnpm run validate-content` to the `lint-and-typecheck` job in `daily-build.yml`
20. - [ ] [P3] [doc] Generate TypeScript types from JSON Schemas via `json-schema-to-typescript` (optional)

### B.2 Theme system completion (10)

21. - [ ] [P0] [ui] Token-sweep 28 hardcoded section badges across hub pages (replace `bg-teal-500/10` etc with `var(--primary-*)`)
22. - [ ] [P0] [ui] Token-sweep `/work/index.astro` hero gradient → use `--primary` instead of hardcoded `from-teal-500 to-violet-500`
23. - [ ] [P0] [ui] Token-sweep `/library/index.astro` accent uses (`text-teal-300`, `bg-teal-500/5`) → `var(--primary-lighter)` + `var(--primary-faint)`
24. - [ ] [P0] [ui] Token-sweep `/me/index.astro` accent uses
25. - [ ] [P0] [ui] Token-sweep `/code/index.astro` accent uses
26. - [ ] [P1] [ui] Token-sweep `/connect/index.astro`, `/gaming/index.astro`, `/system/index.astro`
27. - [ ] [P1] [ui] Token-sweep individual library leaf pages (anime, books, movies, music, manga subdirectories)
28. - [ ] [P2] [ui] Decide whether emerald/amber/rose/sky decorative colours stay as Tailwind utilities (status semantics) — document in `knowledge/decisions/accent-token-policy.md`
29. - [ ] [P2] [ui] Add a "preview accent" feature to the accent picker — hover swatch repaints temporarily (don't persist until clicked)
30. - [ ] [P3] [ui] Audit emerald-500, amber-500, rose-500, sky-500 usages across all pages; flag any that should be `var(--success)` / `var(--warning)` / `var(--danger)` / `var(--info)`

### B.3 Keyboard shortcuts polish (5)

31. - [ ] [P1] [ui] Verify ⌘K opens command palette on every page (regression test in `e2e/`)
32. - [ ] [P1] [ui] Verify ⌘J toggles AI chat on every page
33. - [ ] [P1] [a11y] Add a `?` keystroke that opens a modal listing all keyboard shortcuts
34. - [ ] [P2] [ui] Add `gh` shortcut sequence (Vim-style) → jump to GitHub profile
35. - [ ] [P2] [a11y] Add focus-visible ring on every CMD-K result row

### B.4 TS strict + Biome (10)

36. - [ ] [P0] [ci] Confirm `tsconfig.json` has `noUncheckedIndexedAccess: true` and `exactOptionalPropertyTypes: true`
37. - [ ] [P0] [ci] Run `npx tsc --noEmit` and triage every error (current 0 if previous turn's verification was honest)
38. - [ ] [P1] [ci] Tighten `biome.json` — re-enable `suspicious.noExplicitAny` as a warning instead of error
39. - [ ] [P1] [ci] Re-enable `style.useConst` strictly
40. - [ ] [P1] [ci] Add Biome to the `lint-and-typecheck` job in `daily-build.yml` (currently `continue-on-error: true` — keep that)
41. - [ ] [P2] [ci] Replace `continue-on-error: true` on lint with hard-fail; fix the resulting errors
42. - [ ] [P2] [ci] Replace `continue-on-error: true` on typecheck with hard-fail
43. - [ ] [P2] [ci] Replace `continue-on-error: true` on unit tests with hard-fail
44. - [ ] [P3] [ci] Replace `continue-on-error: true` on e2e with hard-fail (last; e2e is flakiest)
45. - [ ] [P3] [ci] Add a pre-commit hook running Biome on staged files only (via `husky` + `lint-staged`)

### B.5 OG images + meta (8)

46. - [ ] [P0] [seo] Verify `scripts/generate-og-images.ts` actually emits PNGs to `public/og/`
47. - [ ] [P0] [seo] Confirm 57 OG images exist (one per route)
48. - [ ] [P1] [seo] Verify every page's `<head>` references `/og/<slug>.png` via `og:image` and `twitter:image`
49. - [ ] [P1] [seo] Add per-page emoji to the OG card via the page's emoji metadata
50. - [ ] [P2] [seo] Add `og:type article` for blog posts and `og:type profile` for `/me`
51. - [ ] [P2] [seo] Add JSON-LD schema.org markup (Person on `/me`, BlogPosting on blog posts, BreadcrumbList everywhere)
52. - [ ] [P2] [seo] Add a sitemap.xml at the root (audit confirms `src/pages/sitemap.xml.ts` exists; verify it lists every route)
53. - [ ] [P3] [seo] Add `<link rel="alternate" hreflang>` if/when content is translated

### B.6 Fetch real data (7)

54. - [ ] [P0] [setup] Provision `.env.local` with the 28 secrets from `.env.example`
55. - [ ] [P0] [ingest] Run `pnpm run fetch-data` once locally with `.env.local` populated
56. - [ ] [P0] [ingest] Verify `src/content/generated/*.json` populates with real data (movies, books, music, anime, gaming, coding, social, mastodon, reddit, music-platforms, dev-stats)
57. - [ ] [P0] [ingest] Verify each source's `lastUpdated` timestamp is fresh
58. - [ ] [P1] [ci] Trigger `sync-firestore.yml` manually via `gh workflow run sync-firestore.yml` to verify the GitHub-side path
59. - [ ] [P1] [ci] Trigger `snapshot-weekly.yml` manually to verify Firestore → repo flow
60. - [ ] [P1] [doc] Document the fetch-data prereq in `knowledge/runbooks/refresh-firestore-data.md`

---

## C. Phase 2 — Resume + status + contact (40 tasks)

### C.1 RenderCV resume CI (10)

61. - [ ] [P0] [ci] Confirm `.github/workflows/build-resume.yml` triggers on push to `src/content/authored/resume/**`
62. - [ ] [P0] [ci] Confirm `uvx rendercv` step compiles `full.yaml` to PDF
63. - [ ] [P0] [ci] Confirm `backend.yaml` and `ai.yaml` variants build
64. - [ ] [P1] [ci] Tag releases as `resume-<short-sha>` per the workflow
65. - [ ] [P1] [ci] Upload PDFs to the Release with `softprops/action-gh-release@v2`
66. - [ ] [P1] [ui] Update `/work/career` to link to the latest Release asset URL (not a hardcoded path)
67. - [ ] [P2] [ops] Move resume PDF to R2 with stable URL `cdn.oriz.in/resume/latest.pdf` (per services research)
68. - [ ] [P2] [ci] Add `wrangler r2 object put` step in `build-resume.yml` -> #67
69. - [ ] [P3] [doc] Document the 3 variants and their differences in `knowledge/integrations/render-cv.md`
70. - [ ] [P3] [ui] Add a `/work/resume` route with side-by-side variant download buttons

### C.2 Status strip — real /api/now (12)

71. - [ ] [P0] [setup] Join the Lanyard Discord server `https://discord.gg/UrXF2cfJ7F` so the bot can read presence
72. - [ ] [P0] [setup] Get the user's Discord ID (Developer Mode → right-click → Copy User ID); add to `wrangler.toml` as `DISCORD_USER_ID`
73. - [ ] [P0] [setup] Add `LB_USERNAME=chirag127` (ListenBrainz) to `wrangler.toml`
74. - [ ] [P0] [setup] Add `LAT=20.30` and `LON=85.82` (Bhubaneswar approximate) to `wrangler.toml`
75. - [ ] [P0] [ingest:lanyard] Replace `functions/api/now.ts` mock with real `fetch('https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}')`
76. - [ ] [P0] [ingest:listenbrainz] Add `fetch('https://api.listenbrainz.org/1/user/${LB_USERNAME}/playing-now')` to `/api/now`
77. - [ ] [P0] [ingest:open-meteo] Add `fetch('https://api.open-meteo.com/v1/forecast?...')` to `/api/now`
78. - [ ] [P0] [ops] Use `Promise.allSettled` so one upstream failure doesn't 500 the page
79. - [ ] [P0] [ops] Edge-cache `/api/now` with `caches.default` for 60 s; use `waitUntil(cache.put(...))`
80. - [ ] [P1] [ui] Confirm `<StatusStrip>` renders real data on the homepage hero
81. - [ ] [P1] [ui] Add WMO weather-code → emoji mapping (☀️ for code 0–1, ⛅ for 2, ☁️ for 3, etc.)
82. - [ ] [P2] [ui] WebSocket upgrade: switch from polling to Lanyard's `wss://api.lanyard.rest/socket` for real-time presence

### C.3 Contact form + EmailJS + reCAPTCHA (10)

83. - [ ] [P1] [setup] Create EmailJS account and template; get service ID + template ID + public key
84. - [ ] [P1] [setup] Add `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID`, `VITE_EMAILJS_PUBLIC_KEY` to `.env.example` and Cloudflare Pages env
85. - [ ] [P1] [ui] Wire `/connect/contact.astro` form submission to EmailJS via `@emailjs/browser`
86. - [ ] [P1] [setup] Register a reCAPTCHA v3 site at `https://www.google.com/recaptcha/admin/create`
87. - [ ] [P1] [setup] Add `VITE_RECAPTCHA_SITE_KEY` (public) and `RECAPTCHA_SECRET_KEY` (server-only) to `.env.example`
88. - [ ] [P1] [ui] Add reCAPTCHA v3 invisible challenge to the contact form
89. - [ ] [P1] [ops] Build a Cloudflare Pages Function `/api/verify-recaptcha` that POSTs to Google's verify endpoint with `RECAPTCHA_SECRET_KEY`
90. - [ ] [P1] [ui] Show success / failure toast after submission
91. - [ ] [P2] [ui] Add a honeypot `<input>` to catch low-effort spam without challenge friction
92. - [ ] [P2] [ops] Rate-limit `/api/verify-recaptcha` per IP via Cloudflare KV (1 req per 60 s)

### C.4 Status / health page (8)

93. - [ ] [P1] [setup] Create a Cronitor account, free tier (5 monitors)
94. - [ ] [P1] [ops] Add Cronitor heartbeat ping at the end of `sync-firestore.yml` (`curl https://cronitor.link/p/<id>/sync-firestore`)
95. - [ ] [P1] [ops] Add Cronitor heartbeat to `snapshot-weekly.yml`
96. - [ ] [P1] [ops] Add Cronitor heartbeat to `daily-build.yml`
97. - [ ] [P1] [ops] Add Cronitor heartbeat to `build-resume.yml`
98. - [ ] [P2] [ui] Build `src/pages/status.astro` reading the last-run timestamps from Firestore + Cronitor
99. - [ ] [P2] [ui] Render a green/red dot per data source on `/status`
100. - [ ] [P3] [ops] Wire Cronitor → Discord webhook so failures DM the user

---

## D. Phase 3 — Admin + AI tooling (30 tasks)

### D.1 Admin dashboard (8)

101. - [ ] [P1] [ui] Verify `/system/admin` is gated to `isAdminEmail()` check
102. - [ ] [P1] [ui] Wire page-view counter (Firestore `analytics/pageViews/{path}` counter docs)
103. - [ ] [P1] [ui] Wire chat-history viewer (read `chatSessions` + `chatMessages` admin-only)
104. - [ ] [P2] [ui] Add a "data freshness" panel showing each source's `lastUpdated` from `src/content/generated/*.json`
105. - [ ] [P2] [ui] Add a "trigger sync" button → POSTs to `gh workflow run sync-firestore.yml` (admin only)
106. - [ ] [P2] [privacy] Show the last 100 events in the admin table with a public/unlisted/private toggle (after lifestream lands)
107. - [ ] [P3] [ui] Add a "search across collections" input that queries Firestore admin SDK
108. - [ ] [P3] [ui] Build an admin journal-source-control page (read journal.oriz.in API, surface drafts) — see #283

### D.2 AI 22-tool registry (10)

109. - [ ] [P1] [ai] Audit `src/lib/ai/tools/registry.ts` — which 22 tools are wired and which are stubbed
110. - [ ] [P1] [ai] Wire `read_movies` tool to `src/content/generated/movies.json`
111. - [ ] [P1] [ai] Wire `read_books` tool to `src/content/generated/books.json`
112. - [ ] [P1] [ai] Wire `read_music` tool to `src/content/generated/music.json`
113. - [ ] [P1] [ai] Wire `read_anime` tool to `src/content/generated/anime.json`
114. - [ ] [P1] [ai] Wire `read_gaming` tool to `src/content/generated/games.json`
115. - [ ] [P1] [ai] Wire `read_coding` tool to `src/content/generated/coding.json`
116. - [ ] [P1] [ai] Wire `read_social` tool to `src/content/generated/social.json`
117. - [ ] [P2] [ai] Wire `read_journal` tool to `journal.oriz.in/api/recent` (remote API)
118. - [ ] [P2] [ai] Wire `read_now` tool that hits internal `/api/now` for live presence

### D.3 Firestore policy (5)

119. - [ ] [P1] [privacy] Re-enable `aiQueries` collection in `firestore.rules` with admin-write-only
120. - [ ] [P1] [privacy] Re-enable `aiChats` collection
121. - [ ] [P1] [privacy] Re-enable `unknownQueries` collection
122. - [ ] [P2] [privacy] Add a `consents` collection for cookie/analytics consent records
123. - [ ] [P2] [privacy] Document the full Firestore collection map in `knowledge/integrations/firestore.md`

### D.4 Chat improvements (7)

124. - [ ] [P2] [ai] Add per-conversation system prompt selection (Architect / Researcher / Critic / Friend)
125. - [ ] [P2] [ai] Add a "regenerate" button on the last AI message
126. - [ ] [P2] [ai] Add token-count display in the bottom of the chat panel
127. - [ ] [P2] [ai] Persist active model + personality in localStorage
128. - [ ] [P3] [ai] Add a `/share` button that creates a public read-only Firestore doc and copies a URL
129. - [ ] [P3] [ai] Add streaming-cancel via the AbortController already in `ChatWrapper.tsx`
130. - [ ] [P3] [a11y] Add screen-reader live-region on streaming text

---

## E. Phase 4 — CI hardening (25 tasks)

### E.1 Lighthouse CI (8)

131. - [ ] [P1] [ci] Create `.github/workflows/lighthouse.yml`
132. - [ ] [P1] [ci] Run Lighthouse CI against `https://me.oriz.in` after each `main` deploy
133. - [ ] [P1] [ci] Use `treosh/lighthouse-ci-action@v12` with `urls:` covering home, /work, /library, /me, /code
134. - [ ] [P1] [ci] Set perf/a11y/seo/best-practices score thresholds (e.g. perf 0.9, a11y 0.95, seo 0.95)
135. - [ ] [P1] [ci] Upload reports as artifacts; comment on the deploy commit with the score deltas
136. - [ ] [P2] [ci] Wire Lighthouse CI to PR previews (Cloudflare preview deployments) for pre-merge checks
137. - [ ] [P2] [perf] Triage failing perf scores; pick the worst page first
138. - [ ] [P3] [perf] Lazy-load `framer-motion` islands until viewport intersection

### E.2 Visual regression (8)

139. - [ ] [P1] [ci] Re-enable `e2e/screenshots.spec.ts` in CI without `continue-on-error`
140. - [ ] [P1] [ci] Generate baseline screenshots for desktop + mobile (375x812 + 1280x900)
141. - [ ] [P1] [ci] Add `[regen-baselines]` commit-message trigger to refresh baselines
142. - [ ] [P1] [ci] Upload diff PNGs as artifacts on failure
143. - [ ] [P2] [ci] Add visual regression for the 4 themes × 7 accents (28 captures of the homepage)
144. - [ ] [P2] [ci] Pin Chromium version in `playwright.config.ts` to avoid drift across runners
145. - [ ] [P3] [ci] Move screenshot baselines to a separate `e2e/screenshots/baselines/` git LFS track if they grow >10 MB
146. - [ ] [P3] [ci] Add a Playwright trace recorder for failed visual diffs

### E.3 Privacy-friendly analytics (5)

147. - [ ] [P1] [ops] Enable Cloudflare Web Analytics on the Pages project (one toggle in dashboard)
148. - [ ] [P1] [ops] Verify the beacon loads (no extra JS bundled, edge-injected)
149. - [ ] [P2] [ops] Add a Plausible-Cloud or Umami-Cloud free-tier as an A/B comparison (3-month trial)
150. - [ ] [P2] [ops] Document analytics decision in `knowledge/decisions/analytics-choice.md`
151. - [ ] [P3] [privacy] Build a /privacy/dashboard page showing exactly what visitors are tracked

### E.4 Other CI (4)

152. - [ ] [P2] [ci] Run Pagefind index build inside `daily-build.yml` post-build step
153. - [ ] [P2] [ci] Add bundle-size check via `bundlewatch` or `size-limit`
154. - [ ] [P3] [ci] Set up Dependabot for security updates
155. - [ ] [P3] [ci] Set up Renovate for grouped weekly updates

---

## F. Phase 5 — Content authoring (20 tasks)

### F.1 Blog system (10)

156. - [ ] [P1] [ui] Create `src/content/blog/` directory with `_template.mdx`
157. - [ ] [P1] [ui] Add Astro Content Collection config in `src/content/config.ts` (Zod schema for blog frontmatter)
158. - [ ] [P1] [ui] Build `src/pages/blog/index.astro` (list view) and `src/pages/blog/[slug].astro` (post view)
159. - [ ] [P1] [setup] Migrate the four oriz-blog posts (already drafted) to `src/content/blog/`
160. - [ ] [P2] [ui] Add Sandpack integration for live code playgrounds in MDX
161. - [ ] [P2] [ui] Add Mermaid diagram support via `remark-mermaidjs`
162. - [ ] [P2] [ui] Add reading-time estimate to each post
163. - [ ] [P2] [ui] Add Pagefind static search index, surfaced in CMD-K under "Search content"
164. - [ ] [P2] [seo] Add Atom + RSS feeds for the blog
165. - [ ] [P3] [ui] Add a `pnpm run new-post` script that scaffolds a new post with prefilled frontmatter

### F.2 Comments + newsletter (5)

166. - [ ] [P2] [ui] Enable GitHub Discussions on `chirag127/chirag127.github.io`
167. - [ ] [P2] [ui] Add `giscus` to the blog post layout (only blog, not every page)
168. - [ ] [P3] [ops] Create a Buttondown account (free up to 100 subs)
169. - [ ] [P3] [ops] Wire Buttondown's RSS-as-source so posting a blog post → ships a newsletter issue
170. - [ ] [P3] [ui] Add a `<NewsletterCTA>` to the blog post footer

### F.3 Journal (read-only from journal.oriz.in) (5)

171. - [ ] [P0] [setup] Confirm the future `journal.oriz.in` API contract: `GET /api/recent?limit=N` returns latest N entries; auth-gated for write
172. - [ ] [P1] [ingest:journal] Refactor `src/components/islands/JournalApp.tsx` to fetch from `journal.oriz.in/api/recent` instead of writing to local Firestore
173. - [ ] [P1] [ingest:journal] Remove `saveJournalEntry` and `getJournalEntries` from `src/lib/firebase.ts` (no local writes)
174. - [ ] [P1] [privacy] Filter journal API responses to only `visibility: public` entries on the public site
175. - [ ] [P2] [ui] Add a "View on journal.oriz.in" CTA at the end of the `/me/journal` page

---

## G. Phase 6 — Onboarding & forking (15 tasks)

176. - [ ] [P1] [doc] Write a `FORK.md` at the repo root explaining how to fork: replace `src/content/authored/*`, set 14 env vars, push, deploy
177. - [ ] [P1] [doc] Update `README.md` with a "Fork this site" section linking to `FORK.md`
178. - [ ] [P2] [setup] Build a `pnpm run setup-secrets` script (terminal-based) that prompts for each secret and writes `.env.local`
179. - [ ] [P3] [setup] Build a `use-my-browser`-driven walkthrough script: opens Firebase / OpenRouter / simkl / Spotify / Steam / LastFM / ListenBrainz / AniList / WakaTime / DevTo / Bluesky / YouTube / EmailJS / reCAPTCHA / TMDB dashboards in your live browser, prompts you to copy each key
180. - [ ] [P2] [doc] Add a runbook `knowledge/runbooks/fork-this-site.md`
181. - [ ] [P2] [doc] Add an example `.env.example` annotation for every secret with a 1-line description and a link to the provider dashboard
182. - [ ] [P3] [doc] Record a Loom walking through the first deploy
183. - [ ] [P3] [doc] Add a "What this is NOT" section to `FORK.md` (e.g. not a multi-tenant SaaS)
184. - [ ] [P3] [doc] License clarification: code is MIT, content is CC-BY-NC
185. - [ ] [P3] [setup] Add a `pnpm run doctor` that checks: node version, env vars present, Firestore reachable, Puter loaded
186. - [ ] [P3] [doc] Build a `/fork` showcase page listing forks
187. - [ ] [P3] [seo] Add `<meta name="generator" content="me.oriz.in v1.0.0">` so forks are discoverable
188. - [ ] [P3] [ops] Provide a one-click "Deploy to Cloudflare" button in `FORK.md`
189. - [ ] [P3] [doc] Document the matrix of optional vs required services (e.g. site works without simkl, breaks without Firebase)
190. - [ ] [P3] [ops] Provide a Docker-Compose for self-hosted forks (against the project's "no self-hosting" stance — purely as a reference)

---

## H. Lifestream — post-4 architecture (60 tasks)

### H.1 Database (Turso) (10)

191. - [ ] [P0] [db] Create Turso DB: `turso db create lifestream`
192. - [ ] [P0] [db] Generate write token (server-only): `turso db tokens create lifestream`
193. - [ ] [P0] [db] Generate **read-only** token (browser-safe): `turso db tokens create lifestream --read-only`
194. - [ ] [P0] [db] Add `TURSO_DB_URL`, `TURSO_AUTH_TOKEN_WRITE`, `TURSO_AUTH_TOKEN_READ` to `.env.example` and Cloudflare Pages env
195. - [ ] [P0] [db] Create the `events` table per post-4 schema (id, occurred_at, source, kind, title, subtitle, external_id, external_url, cover_url, progress, rating, metadata, ingested_at, UNIQUE(source, external_id, occurred_at))
196. - [ ] [P0] [db] Create indexes: `idx_events_when` on `occurred_at DESC`, `idx_events_kind` on `(kind, occurred_at DESC)`, `idx_events_source` on `(source, occurred_at DESC)`
197. - [ ] [P0] [db] Create the `sources(name, last_synced_at, last_error)` lookup table for "Spotify last synced 2 hours ago" UI
198. - [ ] [P1] [db] Add a `events_public` view that filters to `visibility = 'public'`; the read-only token only sees the view
199. - [ ] [P1] [db] Update `knowledge/decisions/why-firestore-not-turso.md` → `why-turso-for-events-firestore-for-everything-else.md` (per the user's read-only-token correction)
200. - [ ] [P2] [db] Add a backup job: `turso db dump lifestream` to R2 weekly via GitHub Actions

### H.2 Pre-flight setup (5)

201. - [ ] [P0] [setup] `pnpm add @libsql/client` for the Turso JS client
202. - [ ] [P0] [setup] Create `src/lib/lifestream/db.ts` with a singleton `createClient` configured per-token
203. - [ ] [P0] [setup] Create `src/lib/lifestream/types.ts` with the `Event` interface matching the SQL schema
204. - [ ] [P0] [setup] Create `src/lib/lifestream/upsert.ts` with `INSERT OR IGNORE` idempotency
205. - [ ] [P1] [setup] Create `functions/api/_helpers/turso.ts` for use in Pages Functions

### H.3 Week 1 — Music ingest + /music page (12)

206. - [ ] [P0] [setup] Add `LASTFM_API_KEY` to env (already in `.env.example`)
207. - [ ] [P0] [ingest:lastfm] Build `functions/scheduled/ingest-lastfm.ts` (Cloudflare Cron) that polls `user.getRecentTracks` every 1 minute -> #195
208. - [ ] [P0] [ingest:lastfm] Idempotency: dedupe on `${source}:${listened_at}:${recording_msid}` -> #207
209. - [ ] [P0] [ingest:listenbrainz] Build `functions/scheduled/ingest-listenbrainz.ts` polling `/1/user/<u>/listens?count=10` every minute
210. - [ ] [P0] [setup] Add the cron triggers to `wrangler.toml` (`*/1 * * * *` for both)
211. - [ ] [P0] [ui] Build `src/pages/music.astro` (server-rendered) reading the last 50 listen events from Turso via the read-only token
212. - [ ] [P0] [ui] Add a "now playing" tile that hits `/api/now` (already wired) for live data
213. - [ ] [P0] [ui] Render listens as a chronological list with album art (from the metadata JSON column)
214. - [ ] [P1] [ui] Add per-day grouping (e.g. "Today", "Yesterday", "This week", "This month")
215. - [ ] [P1] [ui] Add a "Top 10 of the last 30 days" section with COUNT(*) GROUP BY artist
216. - [ ] [P1] [ui] Link each track to its Spotify / Last.fm canonical URL
217. - [ ] [P2] [ui] Add a heatmap of listening frequency (24h × 7d) at the top of /music

### H.4 Week 2 — Books + home feed (10)

218. - [ ] [P0] [ingest:openlibrary] Build `functions/scheduled/ingest-openlibrary.ts` polling Open Library Reading Log
219. - [ ] [P0] [ingest:openlibrary] Map "Currently Reading", "Read", "Want to Read" shelves to `kind:"book"` events with progress
220. - [ ] [P0] [export] Write a one-shot `scripts/import-goodreads-csv.ts` that ingests the user's Goodreads CSV export into Turso
221. - [ ] [P1] [ingest:hardcover] Optional: Add Hardcover GraphQL ingest as a parallel source
222. - [ ] [P0] [ui] Build `src/pages/read.astro` listing books read this year + currently reading + want-to-read
223. - [ ] [P1] [ui] Add ISBN-based cover fetching via Open Library covers API
224. - [ ] [P0] [ui] Build `src/pages/index.astro` (the `/` "now" feed) merging music + books + (later sources) in reverse chronological order, last 24h
225. - [ ] [P1] [ui] Use Firestore `onSnapshot`-style subscription via libSQL websockets for real-time append (or 30s polling)
226. - [ ] [P2] [ui] Add per-medium emoji prefix to each row in the `/` feed
227. - [ ] [P2] [ui] Empty-state copy when nothing in 24h ("Nothing logged in the last day — try [`/year/2026`](/year/2026) for the bigger picture.")

### H.5 Week 3 — Periodic exports (Google Takeout / YouTube) (12)

228. - [ ] [P0] [setup] Schedule a recurring Google Takeout export every 2 months at takeout.google.com
229. - [ ] [P0] [setup] Provision an R2 bucket `lifestream-raw` for raw export ZIPs
230. - [ ] [P0] [setup] Add `wrangler r2 bucket create lifestream-raw` and document credentials in `.env.example`
231. - [ ] [P0] [ui] Build `functions/api/admin/upload.ts` (auth-gated) that accepts the Takeout ZIP and stores it in `r2://lifestream-raw/takeout/<YYYY-MM-DD>.zip`
232. - [ ] [P0] [export] Build `scripts/parse-youtube-history.ts` that unzips a Takeout, finds `Takeout/YouTube and YouTube Music/history/watch-history.json`, and emits Event rows
233. - [ ] [P0] [export] Idempotency: dedupe on `youtube:${videoId}:${watched_at}`
234. - [ ] [P0] [ingest:youtube] Build `functions/scheduled/process-takeout-uploads.ts` that detects new R2 uploads and runs the parser
235. - [ ] [P0] [ui] Build `src/pages/watch.astro` showing recently watched YouTube videos + simkl episodes
236. - [ ] [P1] [export] Build `scripts/parse-maps-timeline.ts` for `Takeout/Location History/Semantic Location History/<year>/<year>_<month>.json`
237. - [ ] [P1] [ui] Build `src/pages/places.astro` with a Leaflet map of city-level location aggregates (downsampled per privacy policy)
238. - [ ] [P2] [export] Build `scripts/parse-photos-metadata.ts` (just metadata, never the photos themselves)
239. - [ ] [P3] [export] Build `scripts/parse-spotify-extended-history.ts` (one-time backfill of pre-ListenBrainz era)

### H.6 Week 4 — Fitbit + GitHub webhooks + manual /log + PWA (11)

240. - [ ] [P0] [setup] Create a Fitbit developer app at `https://dev.fitbit.com`
241. - [ ] [P0] [setup] Add `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET`, `FITBIT_REFRESH_TOKEN` to `.env.example`
242. - [ ] [P0] [ingest:fitbit] Build `functions/scheduled/ingest-fitbit.ts` polling activities + sleep + steps every hour
243. - [ ] [P0] [ingest:fitbit] Map to `kind:"workout"`, `kind:"sleep"`, `kind:"step"` events
244. - [ ] [P1] [export] Health Connect (Android) monthly export upload route → R2 → ingest worker (no iOS dependency)
245. - [ ] [P0] [webhook] Register a GitHub webhook on the user's main repos pointing at `https://me.oriz.in/api/webhooks/github`
246. - [ ] [P0] [webhook] Build `functions/api/webhooks/github.ts` validating `X-Hub-Signature-256` HMAC against `GITHUB_WEBHOOK_SECRET`
247. - [ ] [P0] [webhook] Map `push`, `pull_request`, `issues`, `release`, `star_created` events to `kind:"code"` documents
248. - [ ] [P0] [ui] Build `src/pages/log.astro` — manual entry form (auth-gated) for things that don't auto-scrobble
249. - [ ] [P1] [ui] Make `/log` a PWA share target so "Share to digital twin" works from any other Android app
250. - [ ] [P0] [setup] Add `manifest.webmanifest` and a service worker via `@vite-pwa/astro`; cache last 30 days of events for offline view

---

## I. Per-source backlog (one ingest worker each, mostly P2) (50 tasks)

### I.1 Music platforms (5)

251. - [ ] [P2] [ingest:spotify] Spotify Web API top tracks / artists ingest (already partially in `fetch-data.ts`)
252. - [ ] [P2] [ingest:mixcloud] Mixcloud API ingest for podcast / DJ-set listens
253. - [ ] [P3] [ingest:apple-music] (skip — no iOS)
254. - [ ] [P3] [ingest:soundcloud] Optional, has a public API
255. - [ ] [P3] [ingest:bandcamp] No public API; skip or scrape RSS

### I.2 Movies / TV / Anime / Manga (10)

256. - [ ] [P2] [ingest:simkl] simkl 15-minute poll → `kind:"watch"`
257. - [ ] [P2] [ingest:anilist] AniList GraphQL 30-minute poll → `kind:"watch"` for anime, `kind:"read"` for manga
258. - [ ] [P2] [ingest:mal] MyAnimeList API as fallback to AniList (low priority — duplicates data)
259. - [ ] [P2] [ingest:simkl] Simkl as a parallel source if simkl rate-limits
260. - [ ] [P2] [ingest:mangadex] MangaDex API for chapter-level reading progress
261. - [ ] [P2] [export:letterboxd] Quarterly Letterboxd CSV import worker
262. - [ ] [P3] [ingest:plex] Plex Media Server webhook → events (only if user runs Plex)
263. - [ ] [P3] [ingest:jellyfin] Jellyfin webhook (only if user runs Jellyfin)
264. - [ ] [P3] [ingest:kitsu] Kitsu API as a parallel-source backup
265. - [ ] [P3] [ingest:bangumi] Bangumi (Chinese-language community) for any titles MAL/AniList don't cover

### I.3 Books / Audiobooks / Podcasts (8)

266. - [ ] [P2] [export:goodreads] Annual Goodreads CSV import (Goodreads added profile ads in mid-2026 — phase out over time)
267. - [ ] [P2] [ingest:hardcover] Hardcover GraphQL daily cron (preferred over Goodreads)
268. - [ ] [P2] [ingest:librivox] LibriVox API for public-domain audiobooks (read-only)
269. - [ ] [P3] [ingest:audible] Audible has no public API → scrape via content script in your browser extension
270. - [ ] [P2] [ingest:gpodder] gpodder.net for podcast subscription state (free WRITE API)
271. - [ ] [P2] [ingest:spotify-podcasts] Spotify Web API podcast saves + episode plays (no listen scrobble)
272. - [ ] [P3] [ingest:overcast] Overcast OPML export (manual, quarterly)
273. - [ ] [P3] [ingest:pocketcasts] Pocket Casts web API (limited)

### I.4 Gaming + visual novels (8)

274. - [ ] [P2] [ingest:steam] Steam Web API `GetRecentlyPlayedGames` poll every hour → `kind:"play"`
275. - [ ] [P2] [ingest:steam] Map games to `external_id` from IGDB for cover art
276. - [ ] [P3] [ingest:vndb] VNDB API v2 (Kana) personal lists for visual novels
277. - [ ] [P3] [ingest:backloggd] Backloggd has no API; monthly scrape
278. - [ ] [P3] [ingest:howlongtobeat] HLTB has no public API; skip
279. - [ ] [P3] [ingest:lichess] Lichess (chess) game history — already in `fetch-data.ts`
280. - [ ] [P3] [ingest:gog] GOG Galaxy has no public API
281. - [ ] [P3] [ingest:epic] Epic Games has no public API

### I.5 Code + dev (8)

282. - [ ] [P1] [ingest:github] GitHub commits + PRs + issues — covered by webhook + `fetch-data.ts` poll backstop
283. - [ ] [P2] [ingest:wakatime] WakaTime daily summary as `kind:"code"` event with duration_seconds
284. - [ ] [P2] [ingest:leetcode] LeetCode submission count poll (read-only — no public API for full submissions)
285. - [ ] [P2] [ingest:codewars] Codewars katas-completed poll
286. - [ ] [P3] [ingest:gitlab] GitLab webhooks (if user has GitLab repos)
287. - [ ] [P3] [ingest:bitbucket] Bitbucket webhooks (low usage)
288. - [ ] [P3] [ingest:devto] DevTo posts as `kind:"post"`
289. - [ ] [P3] [ingest:hashnode] Hashnode posts as `kind:"post"`

### I.6 Social + content (8)

290. - [ ] [P2] [ingest:bluesky] Bluesky `app.bsky.feed.getAuthorFeed` poll → `kind:"post"`
291. - [ ] [P2] [ingest:mastodon] Mastodon ActivityPub RSS feed poll → `kind:"post"`
292. - [ ] [P2] [ingest:reddit] Reddit user JSON poll for posts + comments
293. - [ ] [P3] [ingest:hackernews] HN user JSON poll for submissions + comments
294. - [ ] [P3] [ingest:lemmy] Lemmy ActivityPub feed (if user uses Lemmy)
295. - [ ] [P3] [ingest:pixelfed] Pixelfed ActivityPub feed (already in `fetch-data.ts`)
296. - [ ] [P3] [ingest:youtube-channel] User's own uploads via YouTube Data API
297. - [ ] [P3] [ingest:twitch] Twitch channel + clips (no listen-tracking)

### I.7 Bookmarks + read-later (3)

298. - [ ] [P2] [ingest:raindrop] Raindrop.io API → `kind:"post"` (Pocket dead Jul 2025, Raindrop is the survivor)
299. - [ ] [P3] [export:pocket-archive] One-time import of any Pocket archive the user still has
300. - [ ] [P3] [ingest:hackernews-favorites] HN favorites endpoint (read-only)
