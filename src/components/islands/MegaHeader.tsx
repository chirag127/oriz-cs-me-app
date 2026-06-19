import { useEffect, useRef, useState } from 'react';
import { useAIChatStore } from '../../store/useAIChatStore';
import AuthWidget from './AuthWidget';

/**
 * Mega header — the entire right-side cluster of the sticky top bar.
 *
 * Contains, left → right:
 *   1. Inline search input (always typeable; ⌘K kbd hint; types forward to
 *      the existing #command-palette modal and open it on focus/typing).
 *   2. Theme dropdown — single button showing current theme emoji; click
 *      opens a panel listing all 4 themes (keyboard-navigable).
 *   3. Accent dropdown — single button showing current accent dot; click
 *      opens a 7-swatch grid panel.
 *   4. AI button (🤖) — toggles the chat island.
 *   5. GitHub link (⚓ → external profile).
 *   6. Résumé / Hire Me link.
 *   7. AuthWidget — Google / Puter dual sign-in dropdown.
 *
 * Mobile (< 640px): search-icon + theme cycler (single tap rotates) + accent
 * dropdown + avatar.
 *
 * State: theme + accent persist in localStorage and are applied to <html>
 * via [data-theme] / [data-accent]. The Layout.astro FOUC paint script
 * already hydrates these before first paint; this component just reflects
 * + writes back. See src/styles/tokens.css for the variable map.
 */

type ThemeKey = 'dark' | 'light' | 'amoled' | 'contrast';
type AccentKey =
  | 'teal'
  | 'cyan'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'sky';

const THEME_BUTTONS: {
  key: ThemeKey;
  label: string;
  emoji: string;
  hint: string;
}[] = [
  { key: 'light',    label: 'Light',         emoji: '☀️', hint: 'Bright daytime palette' },
  { key: 'dark',     label: 'Dark',          emoji: '🌙', hint: 'Default low-light palette' },
  { key: 'amoled',   label: 'AMOLED',        emoji: '⚫', hint: 'True-black for OLED screens' },
  { key: 'contrast', label: 'High contrast', emoji: '◑', hint: 'Maximum readability' },
];

const ACCENTS: { key: AccentKey; label: string; swatch: string }[] = [
  { key: 'teal',    label: 'Teal',    swatch: '#14b8a6' },
  { key: 'cyan',    label: 'Cyan',    swatch: '#06b6d4' },
  { key: 'violet',  label: 'Violet',  swatch: '#8b5cf6' },
  { key: 'emerald', label: 'Emerald', swatch: '#10b981' },
  { key: 'amber',   label: 'Amber',   swatch: '#f59e0b' },
  { key: 'rose',    label: 'Rose',    swatch: '#f43f5e' },
  { key: 'sky',     label: 'Sky',     swatch: '#0ea5e9' },
];

function readStored<T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): T {
  if (typeof window === 'undefined') return fallback;
  const v = window.localStorage.getItem(key) as T | null;
  return v && allowed.includes(v) ? v : fallback;
}

function applyTheme(theme: ThemeKey) {
  const html = document.documentElement;
  html.setAttribute('data-theme', theme);
  const isLight = theme === 'light';
  html.classList.toggle('light', isLight);
  html.classList.toggle('dark', !isLight);
}

function applyAccent(accent: AccentKey) {
  const html = document.documentElement;
  if (accent === 'teal') html.removeAttribute('data-accent');
  else html.setAttribute('data-accent', accent);
}

function openPalette(prefill?: string) {
  const el = document.getElementById('command-palette');
  if (!el) return;
  el.classList.remove('hidden');
  const input = el.querySelector<HTMLInputElement>('#command-input');
  if (input) {
    if (prefill !== undefined) input.value = prefill;
    input.focus();
    input.select();
  }
}

function closePalette() {
  const el = document.getElementById('command-palette');
  if (el && !el.classList.contains('hidden')) el.classList.add('hidden');
}

export default function MegaHeader() {
  const toggleChat = useAIChatStore((s) => s.toggleChat);
  const chatOpen = useAIChatStore((s) => s.isOpen);

  const [theme, setTheme] = useState<ThemeKey>('dark');
  const [accent, setAccent] = useState<AccentKey>('teal');
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Dropdown state
  const [themeOpen, setThemeOpen] = useState(false);
  const [accentOpen, setAccentOpen] = useState(false);
  const themeWrapRef = useRef<HTMLDivElement>(null);
  const accentWrapRef = useRef<HTMLDivElement>(null);
  const themeBtnRef = useRef<HTMLButtonElement>(null);
  const accentBtnRef = useRef<HTMLButtonElement>(null);
  const themeItemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Hydrate from localStorage. The FOUC paint already applied these — we
  // just sync state.
  useEffect(() => {
    setTheme(
      readStored<ThemeKey>('theme', 'dark', [
        'dark',
        'light',
        'amoled',
        'contrast',
      ]),
    );
    setAccent(
      readStored<AccentKey>('accent', 'teal', [
        'teal',
        'cyan',
        'violet',
        'emerald',
        'amber',
        'rose',
        'sky',
      ]),
    );
  }, []);

  const onTheme = (next: ThemeKey) => {
    setTheme(next);
    localStorage.setItem('theme', next);
    applyTheme(next);
  };
  const onAccent = (next: AccentKey) => {
    setAccent(next);
    localStorage.setItem('accent', next);
    applyAccent(next);
  };

  // Click-outside close for both dropdowns (mousedown → fires before any
  // click handler that might re-open).
  useEffect(() => {
    if (!themeOpen && !accentOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        themeOpen &&
        themeWrapRef.current &&
        !themeWrapRef.current.contains(target)
      ) {
        setThemeOpen(false);
      }
      if (
        accentOpen &&
        accentWrapRef.current &&
        !accentWrapRef.current.contains(target)
      ) {
        setAccentOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [themeOpen, accentOpen]);

  // Esc closes either dropdown.
  useEffect(() => {
    if (!themeOpen && !accentOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (themeOpen) {
          setThemeOpen(false);
          themeBtnRef.current?.focus();
        }
        if (accentOpen) {
          setAccentOpen(false);
          accentBtnRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [themeOpen, accentOpen]);

  // When the theme menu opens, focus the active item.
  useEffect(() => {
    if (!themeOpen) return;
    const idx = THEME_BUTTONS.findIndex((t) => t.key === theme);
    const target = themeItemRefs.current[idx >= 0 ? idx : 0];
    target?.focus();
  }, [themeOpen, theme]);

  // Forward typing in the inline search to the palette modal — shows the
  // user's full results UI without us reimplementing search.
  const onSearchFocus = () => openPalette(search);
  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSearch(v);
    const palette = document.getElementById('command-palette');
    const paletteInput = palette?.querySelector<HTMLInputElement>(
      '#command-input',
    );
    if (palette?.classList.contains('hidden')) {
      palette.classList.remove('hidden');
    }
    if (paletteInput) {
      paletteInput.value = v;
      // Fire an input event so any future palette-internal filtering picks
      // it up.
      paletteInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };
  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.currentTarget.blur();
      closePalette();
    }
  };

  // Keyboard cycling within the theme menu.
  const onThemeItemKey = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number,
  ) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (idx + 1) % THEME_BUTTONS.length;
      themeItemRefs.current[nextIdx]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx =
        (idx - 1 + THEME_BUTTONS.length) % THEME_BUTTONS.length;
      themeItemRefs.current[prevIdx]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      themeItemRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      themeItemRefs.current[THEME_BUTTONS.length - 1]?.focus();
    }
  };

  const currentTheme =
    THEME_BUTTONS.find((t) => t.key === theme) ?? THEME_BUTTONS[1]!;
  const currentAccent =
    ACCENTS.find((a) => a.key === accent) ?? ACCENTS[0]!;

  return (
    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
      {/* ── Inline search ───────────────────────────────────────────── */}
      <label
        htmlFor="mega-search"
        className="hidden md:flex items-center gap-2 px-3 h-9 w-[260px] xl:w-[320px]
                   rounded-lg border border-[var(--border-default)]
                   bg-[var(--surface-card)] focus-within:bg-[var(--surface-card-hover)]
                   focus-within:border-[var(--primary-subtle)]
                   transition-colors"
      >
        <span className="text-base leading-none" aria-hidden="true">
          🔍
        </span>
        <input
          ref={searchRef}
          id="mega-search"
          type="text"
          value={search}
          onChange={onSearchChange}
          onFocus={onSearchFocus}
          onKeyDown={onSearchKey}
          placeholder="Search anything…"
          className="flex-1 bg-transparent outline-none text-xs
                     text-[var(--text-secondary)]
                     placeholder:text-[var(--text-faint)] min-w-0"
          autoComplete="off"
          aria-label="Search the site"
        />
        <kbd
          className="text-[10px] font-mono text-[var(--text-faint)]
                     px-1.5 py-0.5 rounded border border-[var(--border-subtle)]"
          aria-hidden="true"
        >
          ⌘K
        </kbd>
      </label>

      {/* Mobile search-icon-only fallback */}
      <button
        type="button"
        onClick={() => openPalette()}
        className="md:hidden flex items-center justify-center h-9 w-9
                   rounded-lg text-[var(--text-tertiary)]
                   hover:text-[var(--text-primary)]
                   hover:bg-[var(--surface-card-hover)] transition-colors"
        aria-label="Search"
        title="Search (⌘K)"
      >
        <span className="text-base leading-none" aria-hidden="true">
          🔍
        </span>
      </button>

      {/* ── Theme dropdown (single button) ──────────────────────────── */}
      <div className="hidden sm:block relative" ref={themeWrapRef}>
        <button
          ref={themeBtnRef}
          type="button"
          onClick={() => {
            setAccentOpen(false);
            setThemeOpen((v) => !v);
          }}
          aria-haspopup="menu"
          aria-expanded={themeOpen}
          aria-label={`Theme: ${currentTheme.label}. Open theme menu.`}
          title={`Theme: ${currentTheme.label}`}
          className={`flex items-center justify-center h-9 w-9 rounded-lg
                      border border-[var(--border-default)]
                      bg-[var(--surface-card)]
                      text-base leading-none transition-colors
                      ${
                        themeOpen
                          ? 'bg-[var(--surface-card-hover)] border-[var(--primary-subtle)]'
                          : 'hover:bg-[var(--surface-card-hover)]'
                      }`}
        >
          <span aria-hidden="true">{currentTheme.emoji}</span>
        </button>

        {themeOpen && (
          <div
            role="menu"
            aria-label="Theme"
            className="absolute right-0 top-full mt-2 z-40
                       w-[240px] p-1.5 rounded-xl
                       bg-[var(--surface-elevated)]
                       border border-[var(--border-default)]
                       shadow-2xl"
          >
            {THEME_BUTTONS.map((t, idx) => {
              const active = t.key === theme;
              return (
                <button
                  key={t.key}
                  ref={(el) => {
                    themeItemRefs.current[idx] = el;
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => {
                    onTheme(t.key);
                    setThemeOpen(false);
                    themeBtnRef.current?.focus();
                  }}
                  onKeyDown={(e) => onThemeItemKey(e, idx)}
                  className={`flex w-full items-center gap-3 px-2.5 py-2 rounded-lg
                              text-left transition-colors
                              ${
                                active
                                  ? 'bg-[var(--primary-muted)] ring-1 ring-[var(--primary-subtle)]'
                                  : 'hover:bg-[var(--surface-card-hover)]'
                              }`}
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center
                               rounded-md bg-[var(--surface-card)] text-base leading-none"
                    aria-hidden="true"
                  >
                    {t.emoji}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-semibold text-[var(--text-primary)]">
                      {t.label}
                    </span>
                    <span className="block text-[11px] text-[var(--text-faint)] truncate">
                      {t.hint}
                    </span>
                  </span>
                  {active && (
                    <span
                      className="text-[var(--primary-light)] text-xs"
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile theme cycler — single button that rotates through the 4 */}
      <button
        type="button"
        onClick={() => {
          const idx = THEME_BUTTONS.findIndex((t) => t.key === theme);
          const next = THEME_BUTTONS[(idx + 1) % THEME_BUTTONS.length];
          if (next) onTheme(next.key);
        }}
        className="sm:hidden flex items-center justify-center h-9 w-9
                   rounded-lg text-[var(--text-tertiary)]
                   hover:text-[var(--text-primary)]
                   hover:bg-[var(--surface-card-hover)] transition-colors"
        aria-label="Cycle theme"
        title={`Theme: ${theme}`}
      >
        <span className="text-base leading-none" aria-hidden="true">
          {THEME_BUTTONS.find((t) => t.key === theme)?.emoji ?? '🌙'}
        </span>
      </button>

      {/* ── Accent dropdown (single dot button) ─────────────────────── */}
      <div className="relative" ref={accentWrapRef}>
        <button
          ref={accentBtnRef}
          type="button"
          onClick={() => {
            setThemeOpen(false);
            setAccentOpen((v) => !v);
          }}
          aria-haspopup="menu"
          aria-expanded={accentOpen}
          aria-label={`Accent: ${currentAccent.label}. Open accent menu.`}
          title={`Accent: ${currentAccent.label}`}
          className={`flex items-center justify-center h-9 w-9 rounded-lg
                      border border-[var(--border-default)]
                      bg-[var(--surface-card)] transition-colors
                      ${
                        accentOpen
                          ? 'bg-[var(--surface-card-hover)] border-[var(--primary-subtle)]'
                          : 'hover:bg-[var(--surface-card-hover)]'
                      }`}
        >
          <span
            style={{ background: currentAccent.swatch }}
            className="block h-4 w-4 rounded-full ring-2 ring-[var(--text-primary)]/20"
            aria-hidden="true"
          />
        </button>

        {accentOpen && (
          <div
            role="menu"
            aria-label="Accent colour"
            className="absolute right-0 top-full mt-2 z-40
                       w-[260px] p-3 rounded-xl
                       bg-[var(--surface-elevated)]
                       border border-[var(--border-default)]
                       shadow-2xl"
          >
            <div className="grid grid-cols-7 gap-1.5">
              {ACCENTS.map((a) => {
                const active = a.key === accent;
                return (
                  <div key={a.key} className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      aria-label={`${a.label} accent`}
                      title={a.label}
                      onClick={() => {
                        onAccent(a.key);
                        setAccentOpen(false);
                        accentBtnRef.current?.focus();
                      }}
                      style={{ background: a.swatch }}
                      className={`h-6 w-6 rounded-full transition-transform ring-2
                                  ${
                                    active
                                      ? 'ring-[var(--text-primary)] scale-110'
                                      : 'ring-transparent hover:scale-110'
                                  }`}
                    />
                    <span
                      className={`text-[9px] font-medium leading-none truncate w-full text-center
                                  ${
                                    active
                                      ? 'text-[var(--text-primary)]'
                                      : 'text-[var(--text-faint)]'
                                  }`}
                    >
                      {a.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── AI chat toggle ──────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => toggleChat()}
        aria-pressed={chatOpen}
        className={`flex items-center justify-center h-9 w-9 rounded-lg
                    transition-colors
                    ${
                      chatOpen
                        ? 'bg-[var(--primary-muted)] text-[var(--primary-light)]'
                        : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card-hover)]'
                    }`}
        title="Chirag Twin (⌘J)"
        aria-label="Toggle AI chat"
      >
        <span className="text-base leading-none" aria-hidden="true">
          🤖
        </span>
      </button>

      {/* ── GitHub ──────────────────────────────────────────────────── */}
      <a
        href="https://github.com/chirag127"
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:flex items-center justify-center h-9 w-9 rounded-lg
                   text-[var(--text-tertiary)] hover:text-[var(--text-primary)]
                   hover:bg-[var(--surface-card-hover)] transition-colors"
        aria-label="GitHub profile"
        title="GitHub"
      >
        <svg
          className="h-4 w-4"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M12 .297a12 12 0 0 0-3.79 23.4c.6.111.82-.26.82-.577 0-.286-.011-1.04-.017-2.04-3.338.726-4.042-1.61-4.042-1.61-.546-1.388-1.333-1.757-1.333-1.757-1.09-.745.083-.729.083-.729 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.808 1.304 3.493.997.108-.776.418-1.305.762-1.605-2.665-.305-5.466-1.334-5.466-5.93 0-1.31.467-2.382 1.236-3.222-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23a11.5 11.5 0 0 1 6.003 0c2.291-1.553 3.298-1.23 3.298-1.23.653 1.652.242 2.873.118 3.176.77.84 1.235 1.911 1.235 3.222 0 4.609-2.804 5.624-5.476 5.92.43.371.823 1.103.823 2.222 0 1.604-.015 2.896-.015 3.293 0 .319.218.694.825.576A12 12 0 0 0 12 .297Z" />
        </svg>
      </a>

      {/* ── Résumé / Hire Me ────────────────────────────────────────── */}
      <a
        href="/connect"
        className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg
                   text-xs font-semibold text-white
                   bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)]
                   shadow-md hover:shadow-[var(--shadow-glow-teal)]
                   hover:scale-[1.03] transition-all duration-200"
      >
        <span aria-hidden="true">📄</span>
        <span className="hidden lg:inline">Hire Me</span>
      </a>

      {/* ── AuthWidget (Google + Puter sign in / avatar) ────────────── */}
      <AuthWidget />
    </div>
  );
}
