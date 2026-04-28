import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POSTERS_DIR = path.resolve(__dirname, '../../../public/posters');

/**
 * Ensures the local posters directory exists
 */
async function ensurePostersDir(): Promise<void> {
  await fs.mkdir(POSTERS_DIR, { recursive: true });
}

/**
 * Checks if an image exists locally in the posters directory
 * @param filename - Name of the file (e.g., 'tt123456.jpg')
 */
export async function localImageExists(filename: string): Promise<boolean> {
  try {
    await fs.access(path.join(POSTERS_DIR, filename));
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves an image buffer to the local posters directory
 * @param filename - Name of the file to save as
 * @param buffer - Buffer of the image data
 */
export async function saveLocalImage(
  filename: string,
  buffer: Buffer,
): Promise<string> {
  await ensurePostersDir();
  const filePath = path.join(POSTERS_DIR, filename);
  await fs.writeFile(filePath, buffer);
  console.log(`[Local] Saved: ${filename}`);
  return `/posters/${filename}`;
}

/**
 * Resolves the local URL for a poster
 * @param filename - Name of the file
 */
export function getLocalPosterUrl(filename: string): string {
  return `/posters/${filename}`;
}
