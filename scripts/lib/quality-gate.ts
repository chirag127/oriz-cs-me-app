/**
 * quality-gate.ts — guards every section of the data fetcher against
 * scrambled / trivial / missing API payloads.
 *
 * Wraps each section write with `commitSection(key, newData)`:
 *   1. Load previous data (Firestore `media/<key>` → `public/data/<filename>` fallback).
 *   2. Validate `newData` against the previous snapshot.
 *   3. If valid, push to Firestore and write the local JSON snapshot.
 *   4. If invalid, log the rejection reasons and KEEP the previous data
 *      (the next sync run will try again).
 *
 * Cold start (no Firestore doc, no JSON file on disk) is treated as "first
 * run ever" — newData passes the array shrink/empty checks unconditionally.
 * That's intentional, not a bug; comment is here so future readers don't
 * mistake it for one.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GENERATED_DIR = path.resolve(__dirname, '../../src/content/generated');
const PUBLIC_DATA_DIR = path.resolve(__dirname, '../../public/data');

// ----- Configuration -----------------------------------------------------

/**
 * Reject if a tracked array shrank by more than this fraction vs previous.
 * 0.30 → "lost more than 30% of items in one fetch" looks like flaked API.
 */
export const SHRINK_THRESHOLD = 0.30;

/**
 * Per-section dot-paths to arrays that must not silently empty out.
 * Validator compares prev vs new lengths; see validateSection.
 */
export const ARRAY_PATHS: Record<string, string[]> = {
  movies: ['watched', 'watchlist', 'rated', 'shows'],
  books: ['read', 'reading', 'wantToRead'],
  music: [
    'lastfm.topArtists',
    'lastfm.topTracks',
    'lastfm.topAlbums',
    'lastfm.recentTracks',
    'spotify.topTracks',
    'spotify.topArtists',
    'listenbrainz.topArtists',
    'listenbrainz.topTracks',
    'listenbrainz.recentListens',
  ],
  anime: ['anime', 'manga'],
  gaming: ['steamGames', 'steamRecent'],
  coding: ['github.repos', 'github.topLanguages'],
  social: ['devto', 'bluesky', 'youtube.videos'],
  mastodon: ['statuses'],
  reddit: ['posts', 'comments'],
  'music-platforms': ['mixcloud.cloudcasts'],
  'dev-stats': ['npm.packages', 'stackoverflow.tags'],
};

/**
 * Per-section dot-paths to scalars/objects that must be non-null.
 * If any is missing in newData the section is rejected.
 *
 * Keep this list TIGHT — only fields whose absence unambiguously means the
 * payload is broken. Optional fields (e.g. wakatime, leetcode, holopin) that
 * can legitimately return null when their token is missing or rate-limited
 * must NOT go here, or one flaky optional API will reject an otherwise-good
 * section.
 */
export const REQUIRED_PATHS: Record<string, string[]> = {
  movies: ['stats.totalWatched'],
  coding: ['github.user'],
};

/**
 * Where the section's JSON snapshot lives on disk. Defaults to `<key>.json`
 * unless overridden here. (Frontend reads `games.json`; doc id is `gaming`.)
 */
export const KEY_TO_FILENAME: Record<string, string> = {
  gaming: 'games.json',
};

export function filenameFor(key: string): string {
  return KEY_TO_FILENAME[key] ?? `${key}.json`;
}

// ----- Firestore handle (lazy) -------------------------------------------

let db: FirebaseFirestore.Firestore | null = null;
let firestoreInitTried = false;

/** Initialize firebase-admin once if creds are present. Safe to call repeatedly. */
export function getDb(): FirebaseFirestore.Firestore | null {
  if (firestoreInitTried) return db;
  firestoreInitTried = true;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !rawKey) {
    console.warn(
      '[QualityGate] Firestore creds missing; running in local-only mode.',
    );
    return null;
  }

  try {
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: rawKey.replace(/\\n/g, '\n'),
        }),
        projectId,
      });
    }
    db = getFirestore();
    console.log('[QualityGate] Firestore Admin SDK initialized.');
    return db;
  } catch (e: any) {
    console.error('[QualityGate] Firestore init failed:', e?.message || e);
    db = null;
    return null;
  }
}

// ----- Validator ---------------------------------------------------------

function getByPath(obj: any, path: string): any {
  if (obj == null) return undefined;
  return path.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), obj);
}

export interface ValidationResult {
  ok: boolean;
  reasons: string[];
}

/**
 * Determine whether `newData` is good enough to overwrite `prevData`.
 * Returns ok=true (with empty reasons) on cold start.
 */
export function validateSection(
  key: string,
  newData: any,
  prevData: any,
): ValidationResult {
  const reasons: string[] = [];

  if (newData == null || typeof newData !== 'object') {
    reasons.push('newData is null or not an object');
    return { ok: false, reasons };
  }

  // Required scalar/object paths (these must be present regardless of cold start).
  for (const p of REQUIRED_PATHS[key] ?? []) {
    if (getByPath(newData, p) == null) {
      reasons.push(`required path "${p}" is null/missing`);
    }
  }

  // Array paths: empty-when-prev-had-items, or shrink > threshold.
  for (const p of ARRAY_PATHS[key] ?? []) {
    const newArr = getByPath(newData, p);
    const prevArr = prevData ? getByPath(prevData, p) : undefined;

    if (newArr == null) {
      if (Array.isArray(prevArr) && prevArr.length > 0) {
        reasons.push(`"${p}" missing in newData; prev had ${prevArr.length}`);
      }
      continue;
    }
    if (!Array.isArray(newArr)) {
      reasons.push(`"${p}" is not an array (got ${typeof newArr})`);
      continue;
    }

    if (
      newArr.length === 0 &&
      Array.isArray(prevArr) &&
      prevArr.length > 0
    ) {
      reasons.push(`"${p}" empty; prev had ${prevArr.length}`);
      continue;
    }

    if (Array.isArray(prevArr) && prevArr.length > 0) {
      const drop = (prevArr.length - newArr.length) / prevArr.length;
      if (drop > SHRINK_THRESHOLD) {
        reasons.push(
          `"${p}" shrank ${(drop * 100).toFixed(0)}% (${prevArr.length} → ${newArr.length})`,
        );
      }
    }
  }

  return { ok: reasons.length === 0, reasons };
}

// ----- Previous-data loader ---------------------------------------------

/**
 * Load the previous good snapshot for a section.
 * Tier 1: Firestore `media/<key>`. Tier 2: `public/data/<filename>`.
 * Returns null on cold start (both missing).
 */
export async function loadPrevious(key: string): Promise<any | null> {
  const handle = getDb();
  if (handle) {
    try {
      const snap = await handle.collection('media').doc(key).get();
      if (snap.exists) return snap.data();
    } catch (e: any) {
      console.warn(
        `[QualityGate] Firestore read failed for media/${key}: ${e?.message || e}`,
      );
    }
  }

  const filename = filenameFor(key);
  try {
    const raw = await fs.readFile(
      path.join(PUBLIC_DATA_DIR, filename),
      'utf-8',
    );
    return JSON.parse(raw);
  } catch {
    return null; // cold start
  }
}

// ----- Local JSON writer -------------------------------------------------

async function ensureDirs() {
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.mkdir(PUBLIC_DATA_DIR, { recursive: true });
}

async function writeLocalJson(filename: string, data: any) {
  await ensureDirs();
  const content = JSON.stringify(data, null, 2);
  await fs.writeFile(path.join(GENERATED_DIR, filename), content);
  await fs.writeFile(path.join(PUBLIC_DATA_DIR, filename), content);
}

// ----- Firestore writer --------------------------------------------------

async function pushToFirestore(key: string, data: any): Promise<boolean> {
  const handle = getDb();
  if (!handle) return false;
  try {
    await handle.collection('media').doc(key).set(data, { merge: true });
    return true;
  } catch (e: any) {
    console.error(
      `[QualityGate] Firestore write failed for media/${key}: ${e?.message || e}`,
    );
    return false;
  }
}

// ----- Public commit entrypoint ------------------------------------------

export interface CommitResult {
  committed: boolean;
  reasons: string[];
}

/**
 * Validate `newData` against previous snapshot; on success push to Firestore
 * and write the local JSON file. On failure log and keep the previous data.
 *
 * Pass `newData = null` (e.g. from a try/catch in the orchestrator) to force
 * a rejection with reason "newData is null".
 */
export async function commitSection(
  key: string,
  newData: any,
): Promise<CommitResult> {
  const prev = await loadPrevious(key);
  const { ok, reasons } = validateSection(key, newData, prev);

  if (!ok) {
    console.warn(
      `[QualityGate] REJECTED ${key} — keeping previous data. Reasons:`,
    );
    for (const r of reasons) console.warn(`  - ${r}`);
    return { committed: false, reasons };
  }

  await pushToFirestore(key, newData);
  await writeLocalJson(filenameFor(key), newData);

  console.log(`[QualityGate] OK ${key} — committed to Firestore + disk.`);
  return { committed: true, reasons: [] };
}
