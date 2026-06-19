/**
 * Model Catalog — Puter.js → OpenRouter free-tier models.
 *
 * The catalog lists models whose OpenRouter id ends in `:free` so the entire
 * AI feature runs on free-tier inference. Puter.js is the runtime and it
 * routes these slugs to OpenRouter's free pool.
 *
 * Sourced from `https://openrouter.ai/api/v1/models` (filter id ":free");
 * verified live 2026-06-19. Refresh by re-running that query and updating
 * the entries below — keep the failover chains pointing at ids that still
 * exist (the previous Trinity slug was silently retired).
 */

import type { ModelInfo, ModelTier, QueryIntent } from './types';

export type { ModelInfo, ModelTier } from './types';

// Declare puter global for TypeScript. Puter.js ships as a runtime
// `<script>` and has no upstream .d.ts, so the global stays loosely typed.
// TODO(personal-os/#types): replace `any` once @heyputer/puter.js exports types.
declare const puter: any;

export type AIModel = string;

// ─── Model catalog (OpenRouter :free slugs) ──────────────────────────
// Ordered roughly by descending capability so UIs that pick CATALOG[0]
// land on a strong default.
export const MODEL_CATALOG: ModelInfo[] = [
  {
    id: 'qwen/qwen3-next-80b-a3b-instruct:free',
    name: 'Qwen3 Next 80B',
    params: '80B (3B active)',
    bestFor: 'General reasoning, tool use, agentic flows',
    speed: 'medium',
    reasoning: 'high',
    isFree: true,
    paramSize: 80,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct:free',
    name: 'Llama 3.3 70B',
    params: '70B',
    bestFor: 'Strong general chat, instruction following',
    speed: 'medium',
    reasoning: 'high',
    isFree: true,
    paramSize: 70,
  },
  {
    id: 'qwen/qwen3-coder:free',
    name: 'Qwen3 Coder',
    params: '480B (35B active)',
    bestFor: 'Code generation, debugging, repo-level edits',
    speed: 'medium',
    reasoning: 'high',
    isFree: true,
    paramSize: 480,
  },
  {
    id: 'openai/gpt-oss-120b:free',
    name: 'GPT-OSS 120B',
    params: '120B',
    bestFor: 'Open-weights GPT, balanced reasoning + chat',
    speed: 'slow',
    reasoning: 'high',
    isFree: true,
    paramSize: 120,
  },
  {
    id: 'openai/gpt-oss-20b:free',
    name: 'GPT-OSS 20B',
    params: '20B',
    bestFor: 'Lighter open-weights GPT for fast replies',
    speed: 'fast',
    reasoning: 'medium',
    isFree: true,
    paramSize: 20,
  },
  {
    id: 'liquid/lfm-2.5-1.2b-thinking:free',
    name: 'LFM 2.5 Thinking',
    params: '1.2B',
    bestFor: 'Chain-of-thought reasoning at low cost',
    speed: 'fast',
    reasoning: 'high',
    isFree: true,
    paramSize: 1.2,
  },
  {
    id: 'liquid/lfm-2.5-1.2b-instruct:free',
    name: 'LFM 2.5 Instruct',
    params: '1.2B',
    bestFor: 'Instruction following, RAG, data extraction',
    speed: 'fast',
    reasoning: 'medium',
    isFree: true,
    paramSize: 1.2,
  },
  {
    id: 'meta-llama/llama-3.2-3b-instruct:free',
    name: 'Llama 3.2 3B',
    params: '3B',
    bestFor: 'Cheap fast replies, greetings, navigation',
    speed: 'fast',
    reasoning: 'low',
    isFree: true,
    paramSize: 3,
  },
  {
    id: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
    name: 'Venice Uncensored',
    params: '24B',
    bestFor: 'Uncensored, creative tasks',
    speed: 'slow',
    reasoning: 'high',
    isFree: true,
    paramSize: 24,
  },
];

/**
 * Parse parameter size from string (e.g., "400B", "2.5B", "7B")
 * returns value in Billions. Exported because external callers (e.g.
 * the model picker) sort the catalog by size when the JSON form is
 * preferred over the static `paramSize` field.
 */
export function parseParamSize(str: string): number {
  const match = str.match(/(\d+(\.\d+)?)\s*[Bb]/);
  if (!match) return 0;
  return parseFloat(match[1]!);
}

// ─── Daily snapshot loader ───────────────────────────────────────────
// scripts/fetch-openrouter-models.ts writes this JSON daily via
// .github/workflows/refresh-models.yml. The static MODEL_CATALOG and
// TIER_CHAINS below are the offline fallbacks.
const SNAPSHOT_URL = '/data/openrouter-free-models.json';

interface SnapshotFile {
  fetchedAt: string;
  source: string;
  models: ModelInfo[];
  tiers: Record<ModelTier, AIModel[]>;
}

let snapshotCache: SnapshotFile | null = null;
let snapshotPromise: Promise<SnapshotFile | null> | null = null;

async function loadSnapshot(): Promise<SnapshotFile | null> {
  if (snapshotCache) return snapshotCache;
  if (snapshotPromise) return snapshotPromise;
  // Browser-only: SSG/SSR builds skip the fetch and use the bundled
  // fallback so a missing /data/* doesn't break a static prerender.
  if (typeof window === 'undefined') return null;
  snapshotPromise = (async () => {
    try {
      const res = await fetch(SNAPSHOT_URL, { cache: 'force-cache' });
      if (!res.ok) return null;
      const json = (await res.json()) as SnapshotFile;
      if (!Array.isArray(json.models) || json.models.length === 0) return null;
      snapshotCache = json;
      return json;
    } catch {
      return null;
    }
  })();
  return snapshotPromise;
}

export async function fetchAvailableModels(): Promise<ModelInfo[]> {
  const snap = await loadSnapshot();
  return snap?.models ?? MODEL_CATALOG;
}

/**
 * Async tier chain — uses the daily snapshot when available, falls
 * back to the bundled chains otherwise. Prefer this over getModelChain()
 * for new code; getModelChain stays sync for legacy callers.
 */
export async function fetchModelChain(tier: ModelTier): Promise<AIModel[]> {
  const snap = await loadSnapshot();
  return (
    snap?.tiers[tier] ?? TIER_CHAINS[tier] ?? MODEL_CATALOG.map((m) => m.id)
  );
}

// ─── Tiered failover chains ──────────────────────────────────────────
// `fast` — short, latency-sensitive replies (greetings, navigation hints).
// `reasoning` — chain-of-thought / multi-step answers.
// `agent` — tool use, structured outputs, code edits. Falls back to
// reasoning-class models if the agent-tier head doesn't respond.
const TIER_CHAINS: Record<ModelTier, AIModel[]> = {
  fast: [
    'liquid/lfm-2.5-1.2b-instruct:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'openai/gpt-oss-20b:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
  ],
  reasoning: [
    'qwen/qwen3-next-80b-a3b-instruct:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'openai/gpt-oss-120b:free',
    'liquid/lfm-2.5-1.2b-thinking:free',
  ],
  agent: [
    'qwen/qwen3-coder:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'openai/gpt-oss-120b:free',
  ],
};

/** Get the failover chain for a given tier */
export function getModelChain(tier: ModelTier): AIModel[] {
  return TIER_CHAINS[tier] || MODEL_CATALOG.map((m) => m.id);
}

/** Determine tier from intent */
export function selectTier(
  intent: QueryIntent,
  complexity: 'low' | 'medium' | 'high',
): ModelTier {
  const needsTools = ![
    'greeting',
    'meta',
    'navigation',
    'contact',
    'unknown',
    'gear',
  ].includes(intent);
  if (needsTools) return 'agent';
  if (['greeting', 'meta', 'navigation', 'contact', 'gear'].includes(intent))
    return 'fast';
  if (
    complexity === 'high' ||
    ['career', 'coding', 'projects', 'skills', 'education'].includes(intent)
  )
    return 'reasoning';
  if (complexity === 'medium') return 'reasoning';
  return 'fast';
}
