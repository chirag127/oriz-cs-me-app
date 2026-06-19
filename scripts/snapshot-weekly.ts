/**
 * snapshot-weekly.ts — pulls every authoritative `media/<key>` doc from
 * Firestore and writes it to `src/content/generated/<filename>` and
 * `public/data/<filename>`. The accompanying GitHub Actions workflow then
 * commits these snapshots to the repo so the static site has fresh data
 * baked in at build time.
 *
 * No third-party APIs are touched — this script is an offline mirror.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';

dotenv.config();

import { filenameFor, getDb } from './lib/quality-gate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GENERATED_DIR = path.resolve(__dirname, '../src/content/generated');
const PUBLIC_DATA_DIR = path.resolve(__dirname, '../public/data');

const KEYS = [
  'movies',
  'books',
  'music',
  'anime',
  'gaming',
  'coding',
  'social',
  'mastodon',
  'reddit',
  'music-platforms',
  'dev-stats',
];

/** Warn if a doc's `lastUpdated` is older than this many days. */
const STALE_WARN_DAYS = 14;

async function main() {
  console.log('🗄️  Snapshotting Firestore → repo...');

  const db = getDb();
  if (!db) {
    console.error(
      '❌ Firestore credentials missing — cannot snapshot. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.',
    );
    process.exit(1);
  }

  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.mkdir(PUBLIC_DATA_DIR, { recursive: true });

  const now = Date.now();
  let written = 0;
  let skipped = 0;

  for (const key of KEYS) {
    try {
      const snap = await db.collection('media').doc(key).get();
      if (!snap.exists) {
        console.warn(`[Snapshot] media/${key} missing in Firestore — skipping.`);
        skipped++;
        continue;
      }
      const data = snap.data();
      if (!data) {
        console.warn(`[Snapshot] media/${key} returned no data — skipping.`);
        skipped++;
        continue;
      }

      // Stale-data warning — don't block, but make it visible.
      const lu = (data as any).lastUpdated;
      if (typeof lu === 'string') {
        const ageDays = (now - new Date(lu).getTime()) / 86_400_000;
        if (Number.isFinite(ageDays) && ageDays > STALE_WARN_DAYS) {
          console.warn(
            `[Snapshot] ⚠️  media/${key}.lastUpdated is ${ageDays.toFixed(1)} days old — sync runs may have been rejecting fetches.`,
          );
        }
      }

      const filename = filenameFor(key);
      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(path.join(GENERATED_DIR, filename), content);
      await fs.writeFile(path.join(PUBLIC_DATA_DIR, filename), content);
      console.log(`[Snapshot] Wrote ${filename} (${content.length} bytes)`);
      written++;
    } catch (e: any) {
      console.error(
        `[Snapshot] media/${key} failed: ${e?.message || e}`,
      );
      skipped++;
    }
  }

  console.log(`\n✅ Snapshot complete: ${written} written, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error('❌ Snapshot failed:', err);
  process.exit(1);
});
