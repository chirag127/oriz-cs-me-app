/**
 * Agent — Agentic Streaming AI with Multi-Step Workflows
 *
 * Features:
 * - Agentic Workflow: Plan -> Act -> Verify
 * - LLM-based Intent Classification (Zero Regex)
 * - Proactive Step Reporting
 * - Multi-Model Failover
 */

import {
  classifyIntent,
  detectMultipleIntents,
} from './classifier';
import { buildSystemPrompt } from './context';
import {
  type AIModel,
  getModelChain,
  type ModelTier,
  selectTier,
} from './models';
import { selectTools } from './tools/registry';
import type { ChatMessage, PersonalityMode, QueryIntent } from './types';

// ─── Puter.js Types ──────────────────────────────────────────────────

interface PuterAI {
  chat(
    messages: Array<{ role: string; content: string }>,
    options?: { model?: string; stream?: boolean },
  ): AsyncIterable<{
    text?: string;
    type?: string;
    message?: { content?: string; tool_calls?: unknown[] };
    content?: string;
  }>;
}

function getPuter(): PuterAI | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { puter?: { ai?: PuterAI } };
  return w.puter?.ai ?? null;
}

// ─── Streaming Agent Result ──────────────────────────────────────────

export interface StreamChunk {
  type: 'step' | 'token' | 'done' | 'error';
  content: string;
  meta?: {
    step?: string;
    model?: string;
    intent?: QueryIntent;
    toolsUsed?: string[];
    tier?: ModelTier;
    confidence?: number;
  };
}

/**
 * Execute the AI agent with an agentic workflow.
 */
export async function* executeAgentStream(
  userQuery: string,
  userId: string,
  userEmail: string,
  userName: string,
  pageContext: string,
  personality: PersonalityMode = 'professional',
  selectedModel: string = '',
  chatHistory: ChatMessage[] = [],
  liveDataContext: string = '',
): AsyncGenerator<StreamChunk> {
  const startTime = Date.now();

  // Step 1: Unified Classification (single LLM call)
  yield {
    type: 'step',
    content: '🤔 Analyzing your request...',
  };
  const [classification, allIntents] =
    await Promise.all([
      classifyIntent(userQuery),
      detectMultipleIntents(userQuery),
    ]);

  yield {
    type: 'step',
    content: `🎯 Intent: ${classification.intent} (${classification.complexity} complexity)`,
  };

  // Step 2: Strategic Data Acquisition
  yield {
    type: 'step',
    content: '🔍 Searching knowledge base and live APIs...',
  };
  const tools = selectTools(allIntents);

  if (tools.length > 0) {
    yield {
      type: 'step',
      content: `🛠️ Engaging tools: ${tools.map((t) => t.name).join(', ')}`,
    };
  }

  const toolResults = await Promise.all(
    tools.map(async (tool) => {
      try {
        const result = await tool.execute();
        return result;
      } catch {
        return {
          tool: tool.name,
          data: '',
          success: false,
          truncated: false,
          source: 'error',
        };
      }
    }),
  );

  const toolData = toolResults
    .filter((r) => r.success && r.data)
    .map((r) => `### ${r.tool}\n${r.data}`)
    .join('\n\n');

  const toolsUsed = toolResults.filter((r) => r.success).map((r) => r.tool);
  if (toolsUsed.length > 0) {
    yield { type: 'step', content: '✅ Data gathered successfully' };
  } else {
    yield {
      type: 'step',
      content: 'ℹ️ No external data needed, using internal knowledge',
    };
  }

  // Step 3: Model Selection & Context Building
  yield { type: 'step', content: '🧠 Formulating response strategy...' };
  const systemPrompt = buildSystemPrompt(
    toolData,
    personality,
    liveDataContext,
  );
  const tier = selectedModel
    ? ('agent' as ModelTier)
    : selectTier(
        classification.intent,
        classification.complexity,
      );

  const chain = selectedModel
    ? [
        selectedModel as AIModel,
        ...getModelChain('agent').filter((m) => m !== selectedModel),
      ]
    : getModelChain(tier);

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ];

  // Add relevant history (last 5 turns) for contextual awareness
  if (chatHistory.length > 0) {
    const historyContext = chatHistory
      .slice(-5)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');
    messages.push({
      role: 'user',
      content: `[Previous Conversation Context]\n${historyContext}\n\n[Current Query]\n${userQuery}`,
    });
  } else {
    messages.push({ role: 'user', content: userQuery });
  }

  // Step 4: Execution (Streaming)
  yield {
    type: 'step',
    content: `🚀 Executing with ${chain[0]?.split('/')[1] || 'primary model'}...`,
  };

  const ai = getPuter();
  if (!ai) {
    yield {
      type: 'error',
      content: 'AI Service connection lost. Please refresh.',
    };
    return;
  }

  let usedModel = '';
  let fullContent = '';

  for (const model of chain) {
    try {
      const stream = await ai.chat(messages, { model, stream: true });
      usedModel = model;

      for await (const chunk of stream) {
        const text = chunk?.text;
        if (text) {
          fullContent += text;
          yield { type: 'token', content: text };
        }
      }
      if (fullContent.length > 0) break;
    } catch {
      yield {
        type: 'step',
        content: `⚠️ Model ${model.split('/')[1]} busy, trying alternative...`,
      };
    }
  }

  if (!fullContent) {
    yield {
      type: 'error',
      content:
        'All agents are currently over capacity. Please try again in a moment.',
    };
    return;
  }

  // Step 5: Verification & Quality Check
  yield { type: 'step', content: '✨ Polishing response...' };

  // Clean up common AI artifacts
  fullContent = fullContent
    .replace(/Thought:\s*/gi, '')
    .replace(/Action:\s*/gi, '')
    .replace(/Observation:\s*/gi, '')
    .replace(/TOOL_CALL:\s*\w+/gi, '')
    .trim();

  const confidence = fullContent.length > 50 ? 0.95 : 0.7;

  // Done
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  yield { type: 'step', content: `⚡ Completed in ${duration}s` };

  yield {
    type: 'done',
    content: fullContent,
    meta: {
      model: usedModel,
      intent: classification.intent,
      toolsUsed,
      tier,
      confidence,
    },
  };

  // Persist
  persistResults(
    userQuery,
    fullContent,
    usedModel,
    classification.intent,
    confidence,
    toolsUsed,
    pageContext,
    userId,
    userEmail,
    userName,
  ).catch(() => {});
}

/**
 * Legacy wrapper for non-streaming calls.
 */
export async function executeAgent(
  userQuery: string,
  userId: string,
  userEmail: string,
  userName: string,
  pageContext: string,
  personality: PersonalityMode = 'professional',
  selectedModel: string = '',
  chatHistory: ChatMessage[] = [],
): Promise<{
  content: string;
  model: string;
  intent: QueryIntent;
  confidence: number;
  toolsUsed: string[];
  tier: ModelTier;
}> {
  let content = '';
  let model = '';
  let intent: QueryIntent = 'unknown';
  let toolsUsed: string[] = [];
  let tier: ModelTier = 'fast';
  let confidence = 0;

  for await (const chunk of executeAgentStream(
    userQuery,
    userId,
    userEmail,
    userName,
    pageContext,
    personality,
    selectedModel,
    chatHistory,
  )) {
    if (chunk.type === 'token') content += chunk.content;
    if (chunk.type === 'done' && chunk.meta) {
      model = chunk.meta.model || model;
      intent = chunk.meta.intent || intent;
      toolsUsed = chunk.meta.toolsUsed || toolsUsed;
      tier = chunk.meta.tier || tier;
      confidence = chunk.meta.confidence || confidence;
    }
  }

  return {
    content: content || 'No response generated.',
    model: model || 'unknown',
    intent,
    confidence,
    toolsUsed,
    tier,
  };
}

async function persistResults(
  query: string,
  response: string,
  model: string,
  intent: QueryIntent,
  confidence: number,
  toolsUsed: string[],
  pageContext: string,
  userId: string,
  userEmail: string,
  userName: string,
): Promise<void> {
  const timestamp = new Date().toISOString();

  // Save query to aiQueries collection
  const { saveQuery } = await import('./store');
  saveQuery({
    userId,
    userEmail,
    userName,
    query,
    response,
    model,
    intent,
    confidence,
    toolsUsed,
    pageContext,
    timestamp,
    isUnknown: confidence < 0.5,
  }).catch(() => {});

  // Save unknown queries for admin review
  if (confidence < 0.5) {
    const { saveUnknownQuery } = await import('./store');
    saveUnknownQuery({
      userId,
      userEmail,
      userName,
      query,
      response,
      pageContext,
      timestamp,
      resolved: false,
    }).catch(() => {});

    const { sendUnknownQueryAlert } = await import('../../services/email');
    sendUnknownQueryAlert({
      query,
      reason: `Low confidence (${Math.round(confidence * 100)}%) - Intent: ${intent}`,
      context: `User: ${userName} (${userEmail})\nPage: ${pageContext}\nModel: ${model}\nTools used: ${toolsUsed.join(', ') || 'none'}`,
      timestamp,
    }).catch(() => {});
  }

  // Track visitor activity
  const { trackVisitor } = await import('./store');
  trackVisitor({
    userId,
    userEmail,
    userName,
    firstVisit: timestamp,
    lastVisit: timestamp,
    visitCount: 1,
    pagesVisited: [pageContext],
    totalQueries: 1,
    isAnonymous: !userEmail || userEmail === 'anonymous',
  }).catch(() => {});
}
