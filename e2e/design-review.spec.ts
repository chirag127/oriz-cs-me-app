import { test, expect } from '@playwright/test';

/**
 * Design review screenshots — captures images for human/visual inspection.
 *
 * IMPORTANT: This spec intentionally does NOT use `toHaveScreenshot` (which
 * gates on baseline diffs). It only writes raw PNGs into
 * `test-results/design-review/` so a reviewer can eyeball them.
 *
 * Matrix (19 screenshots total):
 *   - 4 themes × 3 viewports = 12 captures of the homepage
 *   - 4 inner pages (/library, /work, /me, /code) on default theme + desktop
 *   - 3 header close-ups (light/dark/amoled) on desktop, top 80px clip
 */

test.describe.configure({ mode: 'serial' });

const OUT_DIR = 'test-results/design-review';

const THEMES = ['default', 'dark', 'light', 'amoled'] as const;
type Theme = (typeof THEMES)[number];

type Viewport = { name: 'mobile' | 'tablet' | 'desktop'; width: number; height: number };

const VIEWPORTS: Viewport[] = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

const INNER_PAGES = [
  { slug: 'library', path: '/library' },
  { slug: 'work', path: '/work' },
  { slug: 'me', path: '/me' },
  { slug: 'code', path: '/code' },
] as const;

const HEADER_THEMES: Theme[] = ['light', 'dark', 'amoled'];

const DISABLE_ANIMATIONS_CSS = `*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }`;

async function setThemeAndGo(page: import('@playwright/test').Page, theme: Theme, path: string) {
  // Visit once so localStorage has an origin to write to.
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.evaluate((key) => {
    localStorage.setItem('theme', key);
  }, theme);
  // Reload so the FOUC paint script (which runs once on first load) re-applies
  // the theme class from the freshly-written localStorage value.
  await page.reload({ waitUntil: 'networkidle' });
  await page.addStyleTag({ content: DISABLE_ANIMATIONS_CSS });
}

// 1. Homepage: 4 themes × 3 viewports = 12 screenshots.
for (const theme of THEMES) {
  for (const vp of VIEWPORTS) {
    test(`home — theme=${theme} viewport=${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await setThemeAndGo(page, theme, '/');
      await page.screenshot({
        path: `${OUT_DIR}/home-${theme}-${vp.name}.png`,
        fullPage: true,
      });
      expect(true).toBe(true);
    });
  }
}

// 2. Inner pages: 4 screenshots, default theme, desktop viewport.
for (const { slug, path } of INNER_PAGES) {
  test(`page — ${slug}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setThemeAndGo(page, 'default', path);
    await page.screenshot({
      path: `${OUT_DIR}/page-${slug}.png`,
      fullPage: true,
    });
    expect(true).toBe(true);
  });
}

// 3. Header close-ups: 3 screenshots (light/dark/amoled), desktop, top 80px clip.
for (const theme of HEADER_THEMES) {
  test(`header — theme=${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await setThemeAndGo(page, theme, '/');
    await page.screenshot({
      path: `${OUT_DIR}/header-${theme}.png`,
      clip: { x: 0, y: 0, width: 1280, height: 80 },
    });
    expect(true).toBe(true);
  });
}
