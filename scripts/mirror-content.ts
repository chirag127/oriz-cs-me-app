/**
 * mirror-content.ts — copies src/content/authored/*.json to public/data/.
 *
 * Authored JSON is the source of truth. The `public/data/` mirror is what
 * gets served as the runtime read API (`https://me.oriz.in/data/resume.json`).
 * Generated (CI-fetched) JSON is mirrored to public/data/ separately by the
 * fetch-data + snapshot pipeline.
 *
 * Hooks: runs as `prebuild` in package.json so a CI build always picks up
 * the latest authored content. Also safe to run locally.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTHORED_DIR = path.resolve(__dirname, '../src/content/authored');
const PUBLIC_DATA_DIR = path.resolve(__dirname, '../public/data');

async function main() {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(AUTHORED_DIR);
  } catch (e: any) {
    console.error(`[Mirror] ${AUTHORED_DIR} unreadable: ${e?.message || e}`);
    process.exit(1);
  }

  await fs.mkdir(PUBLIC_DATA_DIR, { recursive: true });

  let copied = 0;
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const src = path.join(AUTHORED_DIR, name);
    const dst = path.join(PUBLIC_DATA_DIR, name);
    await fs.copyFile(src, dst);
    copied++;
  }

  console.log(`[Mirror] Copied ${copied} authored JSON file(s) → public/data/`);
}

main().catch((err) => {
  console.error('[Mirror] Failed:', err);
  process.exit(1);
});
