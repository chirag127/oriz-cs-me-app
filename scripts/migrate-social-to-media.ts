/**
 * migrate-social-to-media.ts — one-shot helper.
 *
 * The data fetcher used to push four payloads to the `social/*` Firestore
 * collection: mastodon, reddit, music-platforms, dev-stats. The new pipeline
 * consolidates everything under `media/*` (which is the only collection the
 * existing firestore.rules allow public read on).
 *
 * Run this once locally before merging the refactor:
 *
 *   pnpm exec tsx scripts/migrate-social-to-media.ts
 *
 * It copies social/<k> → media/<k> ONLY if media/<k> doesn't already exist,
 * so it is safe to re-run and won't overwrite fresh data from a sync run.
 *
 * After two clean weekly snapshot cycles you can manually delete the orphan
 * `social/*` docs from the Firebase console.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { getDb } from './lib/quality-gate.js';

const KEYS = ['mastodon', 'reddit', 'music-platforms', 'dev-stats'];

async function main() {
  const db = getDb();
  if (!db) {
    console.error(
      '❌ Firestore credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env',
    );
    process.exit(1);
  }

  let copied = 0;
  let already = 0;
  let missing = 0;

  for (const key of KEYS) {
    const target = await db.collection('media').doc(key).get();
    if (target.exists) {
      console.log(`[Migrate] media/${key} already exists — skipping.`);
      already++;
      continue;
    }

    const src = await db.collection('social').doc(key).get();
    if (!src.exists) {
      console.log(`[Migrate] social/${key} not found — nothing to migrate.`);
      missing++;
      continue;
    }

    const data = src.data();
    if (!data) {
      console.warn(`[Migrate] social/${key} returned no data — skipping.`);
      missing++;
      continue;
    }

    await db.collection('media').doc(key).set(data, { merge: true });
    console.log(`[Migrate] ✓ social/${key} → media/${key}`);
    copied++;
  }

  console.log(
    `\n✅ Migration complete: ${copied} copied, ${already} already present, ${missing} missing.`,
  );
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
