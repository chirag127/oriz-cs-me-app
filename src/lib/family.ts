/*
 * Local vendored copy of @chirag127/oriz-family FAMILY_SITES.
 *
 * Mirrors oriz-home/src/lib/family.ts. When @chirag127/oriz-family ships
 * to npm, replace with `export * from '@chirag127/oriz-family'`.
 *
 * Last synced: 2026-06-19 from chirag127/oriz-family@e90446e.
 */

export const FAMILY = {
  brand: 'oriz',
  rootOrigin: 'https://oriz.in',
  authDomain: 'auth.oriz.in',
  firebaseProjectId: 'oriz-app',
  operator: {
    name: 'Chirag Singhal',
    email: 'whyiswhen@gmail.com',
    address: 'Bhubaneswar, Odisha, India 751001',
    githubHandle: 'chirag127',
  },
  jurisdiction: { country: 'India', state: 'Odisha', city: 'Bhubaneswar' },
  legalUpdated: '2026-06-19',
} as const;

export interface FamilySite {
  slug: string;
  name: string;
  url: string;
  tagline: string;
  emoji: string;
  category: 'reading' | 'tools' | 'finance' | 'personal';
}

export const FAMILY_SITES: FamilySite[] = [
  {
    slug: 'home',
    name: 'oriz',
    url: 'https://oriz.in',
    tagline: 'The hub for the oriz family',
    emoji: '🏠',
    category: 'personal',
  },
  {
    slug: 'me',
    name: 'Me',
    url: 'https://me.oriz.in',
    tagline: 'Chirag Singhal — daily-rebuilt digital identity datasheet',
    emoji: '👤',
    category: 'personal',
  },
  {
    slug: 'blog',
    name: 'Blog',
    url: 'https://blog.oriz.in',
    tagline: 'Long-form writing on engineering, finance, and books',
    emoji: '✍️',
    category: 'reading',
  },
  {
    slug: 'books',
    name: 'Books',
    url: 'https://books.oriz.in',
    tagline: 'NCERT textbook directory + client-side PDF merger',
    emoji: '📚',
    category: 'reading',
  },
  {
    slug: 'book-lore',
    name: 'Book Lore',
    url: 'https://book-lore.oriz.in',
    tagline: '461 book summaries — overview, content, analysis, narration',
    emoji: '📖',
    category: 'reading',
  },
  {
    slug: 'cards',
    name: 'Cards',
    url: 'https://cards.oriz.in',
    tagline: '750 India card profiles — credit, debit, prepaid',
    emoji: '💳',
    category: 'finance',
  },
  {
    slug: 'finance',
    name: 'Finance',
    url: 'https://finance.oriz.in',
    tagline: 'SIP, EMI, FIRE, tax — calculators that show the math',
    emoji: '📊',
    category: 'finance',
  },
  {
    slug: 'journal',
    name: 'Journal',
    url: 'https://journal.oriz.in',
    tagline: 'Privacy-first PWA journal — ten journal types, offline',
    emoji: '📓',
    category: 'personal',
  },
  {
    slug: 'urls-to-md',
    name: 'URLs to Markdown',
    url: 'https://urls-to-md.oriz.in',
    tagline: 'Batch-convert any URL to clean Markdown — 100% client-side',
    emoji: '🔗',
    category: 'tools',
  },
  {
    slug: 'image-tools',
    name: 'Image Tools',
    url: 'https://image.oriz.in',
    tagline: 'Compress, convert, resize — runs in your browser',
    emoji: '🖼️',
    category: 'tools',
  },
  {
    slug: 'pdf-tools',
    name: 'PDF Tools',
    url: 'https://pdf.oriz.in',
    tagline: 'Merge, split, compress, sign — never uploaded',
    emoji: '📄',
    category: 'tools',
  },
];
