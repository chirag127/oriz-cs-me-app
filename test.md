do the following changes in the application
  Area: Stack
  what you have to do Same stack, but strict TS, Biome, exact tokens
  Why it's better: Architecture matches; quality is higher
  ────────────────────────────────────────
  Area: Design system
what you have to do rebuild: 4 themes (dark/light/AMOLED/contrast) + 6-color accent palette in CSS variables
  Why it's better: Theme + accent are theme-able tokens, not hardcoded colors
  ────────────────────────────────────────
  Area: Sidebar
  what you have todo : Nested with collapsible groups, persisted open/closed state, mobile drawer
  Why it's better: All ~70 routes reachable in 1–2 clicks
  ────────────────────────────────────────
  Area: Header
  what you have to do: Sticky top bar with brand, ⌘K search button, AI/theme/accent/GitHub buttons,
    Avatar/Sign-in
  Why it's better: Login is now visible (user complaint was "Sign-in not visible")
  ────────────────────────────────────────
  Area: AI chat
  Original (v1): Always-on overlay
  This rebuild: "chirag twin" floating FAB bottom-right, opens to glass panel with 8 suggested
    prompts, model + personality picker, streaming, history (Firestore + localStorage), ⌘J shortcut
  Why it's better: Matches the user's exact ask models taken and sorted dynamically from openrouter models which have :free in endofthem Mentioned that the. peter.Js sign in is required for the AI feature and both Google and or the authentication Google authentication or. Email password authentication is required for the local storage of for the storage of the chats and all data in the website in the Firestore firebase. And for using AI features pewter dot JS login is required. Mention it as separate everything
  ────────────────────────────────────────
  Area: Auth
  what should be there: AuthModal (Google + email/password) reachable from Header, Footer, and event-based
    open mention puter.js login also  required for AI features
  Why it's better: Now visible from everywhere
  ────────────────────────────────────────
  Area: Dark follow system theme
  what you have to do : Unconditional dark, FOUC-proof inline <style> paint
  Why it's better: Brand experience is intentional
  ────────────────────────────────────────
  Area: Type safety
  Original (v1)what we have: Inconsistent, leaky
  This rebuild todo: Strict TS, exactOptionalPropertyTypes, no any (Biome blocks),
    noUncheckedIndexedAccess
  Why it's better: Quality bar
  ────────────────────────────────────────
  Area: Forkability
  Original : Personal data scattered through code
  what you have to do : All personal data in content/ and src/lib/config.ts in the content folder also everything needs to be json so that it is easier to make a api for the data and all the data is in one place have proper json files and characteristics and proper schema and all for everything you can also use ts for all the content or data but we need the json api somehow research properly on how the json api will work for free this way will work as single shource of truth i think instead we should have this in what everformat we also have many data in the public data folder i am confused which folder to choose
  Why it's better: Anyone can fork → replace content/ → make it theirs
  ────────────────────────────────────────
  Area: Résumé
  Original (v1): Single hand-edited LaTeX file
  This rebuild: RenderCV YAML in content/resume/ → multiple variants (full/backend/AI) compiled by
    CI they only have the information they need or the information that have changed have proper schema for everything
  Why it's better: DRY + multi-variant + scriptable

  ---
what else have to be done :


  1. /code/* routes are stubs — original showed live GitHub stars, repos, languages, NPM packages,
  LeetCode stats, CodeWars, Holopin, Stack Overflow. We have: API modules + components written,
  just not wired to data. Need: run scripts/fetch-data.ts with API keys → emit public/data/*.json →
  page hydrates. this data will be used to populate the above.
  2. /library/* routes are stubs — original had Trakt history, AniList anime/manga, OpenLibrary
  books, ListenBrainz scrobbles, Letterboxd. Same fix: fetch-data + API keys.
  3. /gaming/*, /connect/* routes are stubs — same story.
  4. AI chat doesn't actually answer — Puter.js wired, but 22-tool registry isn't backed by real
  data until public/data/*.json exists. So if you ask "what's Chirag watching?" it says "data
  unavailable".
  5. Homepage status strip is fake — Discord presence (Lanyard), now-playing (ListenBrainz), live
  weather (Open-Meteo) need a Cloudflare Worker /api/now endpoint live.

  🟡 Medium priority — admin & infra

  6. Firebase isn't actually wired — code is correct, but PUBLIC_FIREBASE_* env vars aren't set, so
  AuthModal will show "Firebase not configured" if you try to sign in. Need: create Firebase
  project, paste keys into .env.local. you have access to complete firebasse and playwrite cli and every sskill and many mcp server llike websearch
  7. /system/* admin dashboard is a stub. Original had real Firestore page-view counter +
  chat-history viewer. Need: Firebase project + the API routes reenable them via cloudflare workers
  8. Contact form (/connect/contact) doesn't actually send. Need EmailJS service ID + reCAPTCHA
  site key. Need: EmailJS service ID + reCAPTCHA site key. add teh env example to the repo properly with all the steps and all do everything properly
  9. Résumé PDFs aren't built — RenderCV YAML exists; the GitHub Action that runs uvx rendercv
  isn't wired into a CI run yet. Need: trigger the daily-build workflow. i'm not sure if we should store the resumes in the repo or not or use some free file storage service search the web for free file storage
  10. OG images aren't generated —; needs to run as part of CI
  or first build.

  🟢 Low priority — polish & feature parity

  11. Blog system is empty — only the launch post. Original had MDX posts with Sandpack code
  playgrounds, Pagefind search, Mermaid diagrams.; need to author content.
  12. Journal entries — the journal will be written in the and stored in the firebase only admin can edit or add entries
  13. Visual regression tests / screenshots — Playwright config is ready but no baselines.
  14. Lighthouse CI — config exists, never run.
do proper testing  ---
thisis production site   ---

do everything properly and use my own browser to do everything is there a browser automation tool to automate everything like getting the keys and stuff and pasting tehm to the .env file