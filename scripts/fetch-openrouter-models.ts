/**
 * Fetch OpenRouter free-tier models and snapshot them to JSON.
 *
 * Run daily by .github/workflows/refresh-models.yml. The output drives
 * the chat model picker and the failover chains in src/lib/ai/models.ts;
 * that file keeps a hard-coded copy as the offline fallback.
 *
 * Output: public/data/openrouter-free-models.json
 *   {
 *     "fetchedAt": "2026-06-19T20:30:00.000Z",
 *     "source": "https://openrouter.ai/api/v1/models",
 *     "models": ModelInfo[],
 *     "tiers": { fast: string[]; reasoning: string[]; agent: string[] }
 *   }
 *
 * Behavior:
 * - Filters to ids ending in ":free".
 * - Maps each entry into the ModelInfo shape used by the UI.
 * - Auto-derives failover chains from param size + provider/name hints.
 * - Exits non-zero on network failure or zero results so the workflow
 *   surfaces the problem instead of overwriting good data with empty.
 *
 * The "fetchedAt" stamp is set from process.env.SOURCE_DATE_EPOCH if
 * present (reproducible builds), otherwise new Date(). Workflows pass
 * the run's $GITHUB_RUN_STARTED_AT through SOURCE_DATE_EPOCH so two
 * back-to-back runs with identical OpenRouter results produce the same
 * JSON byte-for-byte and "skip commit on no change" works.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/models';
const OUT_PATH = resolve(
  process.cwd(),
  'public/data/openrouter-free-models.json',
);

// ─── OpenRouter raw shape (only the fields we read) ──────────────────
interface OpenRouterModel {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  architecture?: { input_modalities?: string[] };
}

interface OpenRouterListResponse {
  data: OpenRouterModel[];
}

// ─── Output shape (mirrors src/lib/ai/types.ts ModelInfo) ────────────
interface ModelInfo {
  id: string;
  name: string;
  params: string;
  bestFor: string;
  speed: 'fast' | 'medium' | 'slow';
  reasoning: 'low' | 'medium' | 'high';
  isFree: true;
  paramSize: number;
}

interface SnapshotFile {
  fetchedAt: string;
  source: string;
  models: ModelInfo[];
  tiers: { fast: string[]; reasoning: string[]; agent: string[] };
}

// ─── Param-size + tier inference ─────────────────────────────────────
// Pull "70B", "1.2B", "480B-A35B" out of the model id or name.
function inferParamSizeB(id: string, name: string | undefined): number {
  const haystack = `${id} ${name ?? ''}`;
  // Capture the FIRST size-like token; "480B-A35B" → 480 (total params).
  const match = haystack.match(/(\d+(?:\.\d+)?)\s*[Bb](?![a-zA-Z])/);
  return match ? Number.parseFloat(match[1]!) : 0;
}

function inferSpeed(paramSizeB: number): 'fast' | 'medium' | 'slow' {
  if (paramSizeB <= 5) return 'fast';
  if (paramSizeB <= 80) return 'medium';
  return 'slow';
}

function inferReasoning(
  id: string,
  name: string | undefined,
  paramSizeB: number,
): 'low' | 'medium' | 'high' {
  const tag = `${id} ${name ?? ''}`.toLowerCase();
  if (
    tag.includes('thinking') ||
    tag.includes('reasoning') ||
    tag.includes('coder')
  ) {
    return 'high';
  }
  if (paramSizeB >= 30) return 'high';
  if (paramSizeB >= 5) return 'medium';
  return 'low';
}

function inferBestFor(
  id: string,
  name: string | undefined,
  paramSizeB: number,
): string {
  const tag = `${id} ${name ?? ''}`.toLowerCase();
  if (tag.includes('coder') || tag.includes('code')) {
    return 'Code generation, debugging, repo-level edits';
  }
  if (tag.includes('thinking') || tag.includes('reasoning')) {
    return 'Chain-of-thought reasoning';
  }
  if (
    tag.includes('uncensored') ||
    tag.includes('venice') ||
    tag.includes('dolphin')
  ) {
    return 'Uncensored, creative tasks';
  }
  if (tag.includes('vision') || tag.includes('-vl') || tag.includes('omni')) {
    return 'Multimodal: text + image input';
  }
  if (tag.includes('safety') || tag.includes('content-safety')) {
    return 'Content safety classification';
  }
  if (paramSizeB >= 100) return 'Heavy reasoning, long-context analysis';
  if (paramSizeB >= 30) return 'Strong general chat, instruction following';
  if (paramSizeB >= 5) return 'Balanced general chat';
  return 'Fast cheap replies, RAG, data extraction';
}

function prettyParams(paramSizeB: number): string {
  if (paramSizeB === 0) return '?';
  if (paramSizeB >= 1) return `${paramSizeB}B`;
  return `${paramSizeB * 1000}M`;
}

function shortName(rawName: string | undefined, id: string): string {
  if (!rawName) return id;
  // Strip "Provider: " prefix and " (free)" suffix.
  return rawName
    .replace(/^[^:]+:\s*/, '')
    .replace(/\s*\(free\)\s*$/i, '')
    .trim();
}

// ─── Tier chain derivation ───────────────────────────────────────────
// We build the chains by ranking the catalog and picking the top-N for
// each tier. Stable ordering matters: ties break on id alphabetically.
function buildTierChains(models: ModelInfo[]): SnapshotFile['tiers'] {
  const sorted = [...models].sort((a, b) => {
    if (b.paramSize !== a.paramSize) return b.paramSize - a.paramSize;
    return a.id.localeCompare(b.id);
  });

  // `agent` — strong reasoners, prefer coder-tagged or large params.
  const agent = sorted
    .filter(
      (m) =>
        m.bestFor.toLowerCase().includes('code') ||
        m.bestFor.toLowerCase().includes('reasoning') ||
        m.paramSize >= 30,
    )
    .slice(0, 4)
    .map((m) => m.id);

  // `reasoning` — anything tagged high reasoning OR ≥ 20B params.
  const reasoning = sorted
    .filter((m) => m.reasoning === 'high' || m.paramSize >= 20)
    .slice(0, 4)
    .map((m) => m.id);

  // `fast` — ascending params; small models first.
  const fast = [...models]
    .sort((a, b) => {
      const aSize = a.paramSize === 0 ? Number.POSITIVE_INFINITY : a.paramSize;
      const bSize = b.paramSize === 0 ? Number.POSITIVE_INFINITY : b.paramSize;
      if (aSize !== bSize) return aSize - bSize;
      return a.id.localeCompare(b.id);
    })
    .slice(0, 4)
    .map((m) => m.id);

  return { fast, reasoning, agent };
}

// ─── Fetch + transform ───────────────────────────────────────────────
async function fetchOpenRouter(): Promise<OpenRouterModel[]> {
  const res = await fetch(OPENROUTER_URL, {
    headers: { 'User-Agent': 'chirag127.github.io/refresh-models' },
  });
  if (!res.ok) {
    throw new Error(
      `OpenRouter ${OPENROUTER_URL} returned ${res.status} ${res.statusText}`,
    );
  }
  const json = (await res.json()) as OpenRouterListResponse;
  if (!json.data || !Array.isArray(json.data)) {
    throw new Error('OpenRouter response missing .data array');
  }
  return json.data.filter((m) => m.id.endsWith(':free'));
}

function toModelInfo(m: OpenRouterModel): ModelInfo {
  const paramSize = inferParamSizeB(m.id, m.name);
  return {
    id: m.id,
    name: shortName(m.name, m.id),
    params: prettyParams(paramSize),
    bestFor: inferBestFor(m.id, m.name, paramSize),
    speed: inferSpeed(paramSize),
    reasoning: inferReasoning(m.id, m.name, paramSize),
    isFree: true,
    paramSize,
  };
}

// ─── Determinism helper ──────────────────────────────────────────────
// Use SOURCE_DATE_EPOCH from CI if present so byte-identical OpenRouter
// responses produce byte-identical JSON. Otherwise stamp with now().
function stableTimestamp(): string {
  const epochEnv = process.env.SOURCE_DATE_EPOCH;
  if (epochEnv && /^\d+$/.test(epochEnv)) {
    return new Date(Number(epochEnv) * 1000).toISOString();
  }
  return new Date().toISOString();
}

// ─── Main ────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  process.stdout.write(`Fetching ${OPENROUTER_URL} ...\n`);
  const raw = await fetchOpenRouter();
  if (raw.length === 0) {
    throw new Error(
      'OpenRouter returned zero :free models — refusing to overwrite snapshot.',
    );
  }
  const models = raw.map(toModelInfo).sort((a, b) => a.id.localeCompare(b.id));

  const snapshot: SnapshotFile = {
    fetchedAt: stableTimestamp(),
    source: OPENROUTER_URL,
    models,
    tiers: buildTierChains(models),
  };

  // Compare against existing file: if the only difference is fetchedAt,
  // keep the old timestamp so the file is byte-identical and the
  // workflow's "no-op skip" branch fires.
  const serialized = await stableSerialize(snapshot);
  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, serialized, 'utf8');

  process.stdout.write(
    `Wrote ${models.length} models + tier chains to ${OUT_PATH}\n`,
  );
}

/**
 * Serialize the snapshot, but if the only diff vs the file on disk is
 * the timestamp, preserve the old timestamp. This makes "diff against
 * yesterday" trivial — `git diff --quiet` is enough to decide skip.
 */
async function stableSerialize(snap: SnapshotFile): Promise<string> {
  let priorRaw: string | null = null;
  try {
    priorRaw = await readFile(OUT_PATH, 'utf8');
  } catch {
    /* first run — no prior file */
  }
  if (priorRaw) {
    try {
      const prior = JSON.parse(priorRaw) as SnapshotFile;
      const candidate = { ...snap, fetchedAt: prior.fetchedAt };
      const candidateJson = `${JSON.stringify(candidate, null, 2)}\n`;
      if (candidateJson === priorRaw) {
        return priorRaw;
      }
    } catch {
      /* prior file unparseable — overwrite */
    }
  }
  return `${JSON.stringify(snap, null, 2)}\n`;
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`refresh-models failed: ${msg}\n`);
  process.exit(1);
});
