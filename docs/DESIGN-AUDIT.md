# Site design audit — Phase 1

> Generated 2026-06-19. Phase 1 of a multi-session walk-through.
> Source: read-only audit by frontend-design-aware Explore agent.

## Inventory (57 routes)

| Section | Pages | Notes |
| --- | --- | --- |
| Index | 1 | Strong hero with gradient text, ambient glows, floating badges |
| Work | 6 | index, career, skills, projects, education, certifications |
| Library | 18 | index + movies/tv/anime/books/music groups + manga, podcasts, twitch, videos, mixcloud |
| Me | 7 | index, story, philosophy, interests, gear, journal, finance |
| Connect | 17 | index, contact, + 14 social/dev/gaming/music/reading link pages |
| Code | 5 | index, repos, npm, stackoverflow, holopin |
| Gaming | 1 | index |
| System | 3 | index, changelog, admin |
| Legal/404 | 5 | 404, privacy, terms, disclaimer, cookie-policy |

## Cross-cutting findings

### Hardcoded Tailwind colours sit on every page
56 of 57 pages match `(teal|violet|emerald|amber|rose|sky|cyan)-\d{3}`. The token system in `src/styles/tokens.css` exists and is correct, but pages bypass it and use raw Tailwind utilities. Net effect: the accent dropdown only repaints the components that already use `var(--primary)` (Layout, Sidebar, AuthBanner). All page-level UI stays teal regardless.

### One unabstracted "section badge" repeats 28 times
Every section index page hand-rolls the same status-badge pattern:
```html
<div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
            bg-teal-500/5 border border-teal-500/15
            text-[11px] font-semibold text-teal-400 ...">
  <span class="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse"></span>
  SECTION NAME
</div>
```
All hardcoded. Fixing this single pattern flips 28 surfaces to accent-aware.

### Cards are partially abstracted
- **Glass card** (`class="glass p-6"`) — used 200+ times, defined in `src/styles/global.css`. ✓ Good.
- **Stat card** — duplicated across homepage, work/index, code/index, me/index, gaming/index, library/index. 8 pages, ~60 instances. No abstraction.
- **Link card** (icon + title + description + arrow) — duplicated in work/index (6), me/index (6), connect/index (3 sections × ~5 links). ~25 instances. No abstraction.

### Empty / fallback states are inconsistent
- `/library/*` pages use a fallback gradient set hardcoded inline (8 files × 4–6 gradients each = 400+ lines of repetitive inline styles).
- `/code/holopin`, `/code/npm`, `/code/stackoverflow`, `/connect/{mastodon,reddit,bluesky}`, `/gaming/index`: render blank or warn-only when data missing.
- Only one page (`/code/repos`) has a friendly empty-state with emoji + microcopy.

### Hero gradients duplicated as inline styles
Multiple pages render the same ambient-glow blur as inline `style` blocks:
```html
<div style="background: rgba(20,184,166,0.08);" ...></div>
```
Hardcoded teal RGBA — won't follow the accent.

## Component reuse opportunities

| Component | Surfaces | Effort | Priority |
| --- | --- | --- | --- |
| `<PageHeader>` (badge + h1 + description, optional emoji) | 30+ pages | Low | **Critical** |
| `<StatCard>` | 8 pages, ~60 instances | Low | High |
| `<EmptyState>` (emoji + title + msg + optional CTA) | 20+ pages | Medium | High |
| `<LinkCard>` | 15+ instances | Medium | Medium |
| `<HeroGlow>` (ambient blur backdrop driven by accent token) | 6+ pages | Low | Medium |
| Fallback gradient module (anime/books/movies/manga) | 8 pages | Medium | Low |

## Phase 1 fixes (this session)

| # | Fix | Effort | Notes |
| --- | --- | --- | --- |
| 1 | **Mega header** — search + 4 theme icons + 7 accent dots + AI/GitHub/Resume/Avatar | High | The user's primary ask this turn. Already in flight. |
| 2 | **Sidebar emoji injection** | Low | ✓ Done (70 emojis added) |
| 3 | **Accent token sweep** through Layout, Sidebar, hero, AuthBanner, AuthWidget, ChatWrapper, CommandPalette | Medium | Layout + index.astro already done by linter pass. Remaining: Sidebar, AuthWidget, AuthBanner, CommandPalette, ChatWrapper, badges in section index pages. |
| 4 | **PageHeader component** + adopt on 8 section landings | Low–Med | If time permits this turn. |
| 5 | **EmptyState component** + adopt on /library/* + /code/* | Medium | If time permits this turn. |

## Backlog for next session

| # | Fix | Why later |
| --- | --- | --- |
| 1 | Fallback gradient system (8 library pages) → JSON config | Touches 400 lines; needs design pass on the new gradient set |
| 2 | StatCard component + 60-instance migration | Pages render fine today; abstraction is hygiene, not feature |
| 3 | LinkCard component + 25-instance migration | Same |
| 4 | Section-header emojis within pages (`≪ Skills`, `Projects`, etc.) | Better with PageHeader/SectionHeader pair landed first |
| 5 | Empty-state illustrations (Lottie / SVG) | Needs design assets |
| 6 | LeetCode progress bars responsive at 320px | Edge-case mobile QA |
| 7 | Alt-text audit | Accessibility pass |
| 8 | Mobile tab navigation consistency (`/code/repos` filters, `/library/*` filters, `/me/gear` tabs) | Needs UX review |
| 9 | Visual regression baselines via existing `screenshots.spec.ts` | Needs the redesign to settle first |

## Token reference (already correct, just under-used)

- **Primary accent:** `var(--primary)` (teal default). Variants: `--primary-light`, `--primary-lighter`, `--primary-dark`, `--primary-darker`, `--primary-faint`, `--primary-muted`, `--primary-subtle`.
- **Glow:** `--shadow-glow-teal` (semantic — name is legacy, value swaps with accent).
- **Text:** `--text-primary` … `--text-faint` (5 levels).
- **Surfaces:** `--surface-base` / `-raised` / `-elevated` / `-overlay` / `-card` / `-card-hover` / `-sidebar`.
- **Borders:** `--border-subtle` / `-default` / `-hover` / `-active` / `-focus`.

## Accent switch plumbing (works end to end)

`:root[data-accent='<key>']` overrides `--primary*` for `cyan / violet / emerald / amber / rose / sky`. Default (`teal`) is the bare `:root` block. The FOUC paint script in `Layout.astro` reads `localStorage.accent` and sets `data-accent` on `<html>` before first paint. Confirmed working in `Layout.astro` lines 132–157.

## Bottom line

The system is **architecturally sound** — tokens, themes, spacing, typography all defined. The failure is **adoption**: pages don't consume tokens. Bridging that gap (steps 1–3 above) is the single highest-leverage thing to ship this session.
