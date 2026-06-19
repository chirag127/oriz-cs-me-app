import { useEffect, useRef, useState } from 'react';

export type ThemeKey = 'dark' | 'light' | 'amoled' | 'contrast';
export type AccentKey =
  | 'teal'      // default — matches the :root token
  | 'cyan'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'sky';

const THEMES: { key: ThemeKey; label: string; hint: string }[] = [
  { key: 'dark',     label: 'Dark',         hint: 'Default' },
  { key: 'light',    label: 'Light',        hint: 'Inverted' },
  { key: 'amoled',   label: 'AMOLED',       hint: 'True black' },
  { key: 'contrast', label: 'High contrast', hint: 'WCAG AAA' },
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

function readStored<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  if (typeof window === 'undefined') return fallback;
  const v = window.localStorage.getItem(key) as T | null;
  return v && allowed.includes(v) ? v : fallback;
}

function applyTheme(theme: ThemeKey) {
  document.documentElement.setAttribute('data-theme', theme);
  // Keep the legacy .dark / .light classes in sync — Tailwind's dark:
  // variant still uses them, and we don't want to migrate ~500 utility
  // classes today. AMOLED + contrast are dark-family.
  const isLight = theme === 'light';
  document.documentElement.classList.toggle('light', isLight);
  document.documentElement.classList.toggle('dark', !isLight);
}

function applyAccent(accent: AccentKey) {
  // 'teal' is the :root default; remove the attribute so the cascade
  // falls through to the base tokens instead of overriding with
  // identical values.
  if (accent === 'teal') {
    document.documentElement.removeAttribute('data-accent');
  } else {
    document.documentElement.setAttribute('data-accent', accent);
  }
}

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeKey>('dark');
  const [accent, setAccent] = useState<AccentKey>('teal');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage on mount. The FOUC-paint script in
  // Layout.astro already applied these to <html> before this ran;
  // we just sync state.
  useEffect(() => {
    setTheme(readStored<ThemeKey>('theme', 'dark', ['dark', 'light', 'amoled', 'contrast']));
    setAccent(readStored<AccentKey>('accent', 'teal', ['teal', 'cyan', 'violet', 'emerald', 'amber', 'rose', 'sky']));
  }, []);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

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

  const currentAccent = ACCENTS.find((a) => a.key === accent) ?? ACCENTS[0];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-default)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-colors"
        aria-label="Theme and accent settings"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className="inline-block h-3 w-3 rounded-full ring-1 ring-white/20"
          style={{ background: currentAccent?.swatch }}
          aria-hidden="true"
        />
        <span className="hidden sm:inline">Theme</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-xl border border-[var(--border-default)] bg-[var(--surface-elevated)] shadow-2xl overflow-hidden z-40"
        >
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Theme
          </div>
          {THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              role="menuitemradio"
              aria-checked={t.key === theme}
              onClick={() => onTheme(t.key)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs text-left hover:bg-[var(--surface-card-hover)] ${
                t.key === theme ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
              }`}
            >
              <span>{t.label}</span>
              <span className="text-[10px] text-[var(--text-muted)]">
                {t.key === theme ? '✓' : t.hint}
              </span>
            </button>
          ))}
          <div className="border-t border-[var(--border-subtle)] mt-1 pt-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Accent
          </div>
          <div className="grid grid-cols-7 gap-1.5 p-3">
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                type="button"
                role="menuitemradio"
                aria-checked={a.key === accent}
                aria-label={a.label}
                title={a.label}
                onClick={() => onAccent(a.key)}
                className={`h-6 w-6 rounded-full ring-2 transition-transform ${
                  a.key === accent
                    ? 'ring-[var(--text-primary)] scale-110'
                    : 'ring-transparent hover:scale-105'
                }`}
                style={{ background: a.swatch }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
