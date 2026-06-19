/**
 * ChatWrapper — Streaming AI chat with step indicators
 *
 * Features:
 * - Model selector dropdown (6 free Puter.js models)
 * - Mode selector dropdown (4 personality modes)
 * - Real-time step indicators (classifying, fetching, generating)
 * - Streaming text display (tokens appear as they arrive)
 * - Firebase + Puter.js dual auth
 * - Chat persistence to Firestore
 */

import React, {
  type CSSProperties,
  type FormEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { executeAgentStream } from '../../lib/ai/agent';
import {
  fetchAllLiveData,
  buildLiveDataContext,
} from '../../lib/api/client-fetchers';
import { MODEL_CATALOG } from '../../lib/ai/models';
import type {
  ChatMessage,
  PersonalityMode,
} from '../../lib/ai/types';
import { useAuthStore } from '../../lib/authStore';
import { useAIChatStore } from '../../store/useAIChatStore';

// ─── Draggable Button ──────────────────────────────────────────────
function DraggableButton({ onOpen }: { onOpen: () => void }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const moved = useRef(false);
  const onOpenRef = useRef(onOpen);

  useEffect(() => {
    onOpenRef.current = onOpen;
  }, [onOpen]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('chat-btn-pos');
      if (saved) setPos(JSON.parse(saved));
    } catch {}
  }, []);

  const onPointerDown = useCallback(
    (e: PointerEvent) => {
      dragging.current = true;
      moved.current = false;
      start.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pos],
  );

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
    setPos({ x: start.current.px + dx, y: start.current.py + dy });
  }, []);

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      dragging.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      try {
        localStorage.setItem('chat-btn-pos', JSON.stringify(pos));
      } catch {}
      if (!moved.current) onOpenRef.current();
    },
    [pos],
  );

  const style: CSSProperties = {
    position: 'fixed',
    bottom: pos.x === 0 && pos.y === 0 ? 32 : undefined,
    right: pos.x === 0 && pos.y === 0 ? 32 : undefined,
    left: pos.x !== 0 || pos.y !== 0 ? pos.x : undefined,
    top: pos.x !== 0 || pos.y !== 0 ? pos.y : undefined,
    zIndex: 40,
    touchAction: 'none',
    cursor: 'grab',
  };

  return (
    <div style={style} className="select-none group">
      <div className="absolute inset-0 bg-[var(--primary-subtle)] blur-[24px] rounded-full animate-pulse pointer-events-none" />
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative flex items-center justify-center gap-2 px-5 py-3.5 bg-[#1a1a2e]/95 backdrop-blur-2xl text-white rounded-full font-bold shadow-[var(--shadow-glow-teal)] border border-[var(--primary-subtle)] hover:bg-[#1a1a2e] hover:border-[var(--primary)] transition-all overflow-hidden"
      >
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--primary-light)] to-transparent" />
        <svg
          className="h-5 w-5 text-[var(--primary-light)] group-hover:scale-110 transition-transform flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
          />
        </svg>
        <span className="text-sm uppercase tracking-widest bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] bg-clip-text text-transparent group-hover:from-white group-hover:to-white transition-all hidden sm:inline">
          Ask Chirag
        </span>
      </div>
    </div>
  );
}

// ─── Markdown Renderer ──────────────────────────────────────────────
function renderMd(input: string): string {
  let h = input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  h = h.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    '<pre style="background:#0a0a14;padding:12px;border-radius:8px;overflow-x:auto;font-size:12px;margin:8px 0"><code>$2</code></pre>',
  );
  h = h.replace(
    /`([^`]+)`/g,
    '<code style="background:#0a0a14;padding:2px 6px;border-radius:4px;font-size:12px">$1</code>',
  );
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/\*(.+?)\*/g, '<em>$1</em>');
  h = h.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener" style="color:var(--primary-light);text-decoration:underline">$1</a>',
  );
  h = h.replace(
    /^[-*] (.+)$/gm,
    '<li style="margin-left:16px;list-style:disc">$1</li>',
  );
  h = h
    .split(/\n{2,}/)
    .map((p) => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<pre') || p.startsWith('<h') || p.startsWith('<li'))
        return p;
      return `<p style="margin:0 0 8px">${p}</p>`;
    })
    .filter(Boolean)
    .join('');
  return h;
}

// ─── Dropdown Component ─────────────────────────────────────────────
function Dropdown({
  label,
  options,
  value,
  onChange,
  width = 'w-44',
}: {
  label: string;
  options: { value: string; label: string; sub?: string; isFree?: boolean }[];
  value: string;
  onChange: (v: string) => void;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    if (open) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-white/60 hover:text-white/80 hover:bg-white/5 border border-white/10 transition-all"
      >
        <span className="hidden sm:inline truncate max-w-[100px]">
          {selected?.label || label}
        </span>
        <svg
          className={`h-3 w-3 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && (
        <div
          className={`absolute right-0 top-full mt-1 ${width} rounded-xl bg-[#1a1a2e] border border-white/10 shadow-2xl overflow-hidden z-50 max-h-[400px] overflow-y-auto`}
        >
          <div className="p-2 text-[10px] text-white/40 uppercase tracking-wider sticky top-0 bg-[#1a1a2e]">
            {label}
          </div>
          {options.map((opt, idx) => {
            const prev = idx > 0 ? options[idx - 1] : null;
            const showDivider = opt.isFree && prev && !prev.isFree;
            return (
              <React.Fragment key={opt.value}>
                {showDivider && (
                  <div className="px-3 py-1.5 text-[9px] text-emerald-400/60 uppercase tracking-widest border-t border-white/5 mt-1 pt-2 flex items-center gap-2">
                    <span className="h-px flex-1 bg-white/5" />
                    Free Models
                    <span className="h-px flex-1 bg-white/5" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left hover:bg-white/5 transition-colors group/opt ${
                    value === opt.value ? 'bg-[var(--primary-muted)]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`text-sm flex items-center gap-1.5 ${value === opt.value ? 'text-[var(--primary-light)]' : 'text-white/80'}`}
                    >
                      {opt.label}
                    </div>
                    {opt.isFree && (
                      <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase">
                        Free
                      </span>
                    )}
                  </div>
                  {opt.sub && (
                    <div className="text-[10px] text-white/40 mt-0.5">
                      {opt.sub}
                    </div>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Step Indicator ──────────────────────────────────────────────────
function StepIndicator({
  steps,
  streaming,
}: {
  steps: string[];
  streaming: boolean;
}) {
  const [_hideTimer, setHideTimer] = React.useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const lastStep = steps[steps.length - 1];

  React.useEffect(() => {
    if (!streaming && steps.length > 0) {
      const timer = setTimeout(() => setHideTimer(null), 100);
      return () => clearTimeout(timer);
    }
    setHideTimer(null);
  }, [streaming, steps.length]);

  if (steps.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 py-1">
      <div
        className="flex items-center gap-2 text-[11px] text-[var(--primary-light)] font-medium transition-all duration-200"
        style={{ animation: 'fadeIn 0.2s ease-out forwards' }}
      >
        <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--primary-light)] animate-pulse shadow-[var(--shadow-glow-teal)]" />
        <span className="truncate">{lastStep}</span>
      </div>
    </div>
  );
}

// ─── Intent Badge & Confidence Bar ─────────────────────────────────
function IntentBadge({ intent }: { intent: string }) {
  const colors: Record<string, string> = {
    career: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
    coding: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    projects: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
    skills: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    education: 'bg-teal-500/15 text-teal-400 border-teal-500/20',
    movies: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
    music: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
    books: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
    anime: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/20',
    gaming: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20',
    gear: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
    social: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    contact: 'bg-lime-500/15 text-lime-400 border-lime-500/20',
    navigation: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
    general: 'bg-white/10 text-white/50 border-white/10',
    unknown: 'bg-red-500/15 text-red-400 border-red-500/20',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md border ${colors[intent] || colors.general}`}
    >
      {intent}
    </span>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color =
    pct >= 70 ? 'bg-emerald-400' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2 min-w-[60px]">
      <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[9px] text-white/20">{pct}%</span>
    </div>
  );
}

// ─── Main Chat Panel ────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string | undefined;
  intent?: string | undefined;
  confidence?: number | undefined;
  toolsUsed?: string[] | undefined;
  tier?: string | undefined;
  steps?: string[] | undefined;
  streaming?: boolean | undefined;
}

const SUGGESTED = [
  'What does Chirag work on?',
  'What are his skills?',
  'What movies has he watched?',
  'What gear does he use?',
  'Show his GitHub stats',
  'What anime is he watching?',
];

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

// ─── localStorage chat persistence ─────────────────────────────────
const CHAT_STORAGE_KEY = 'chirag-chat-sessions';
const CURRENT_SESSION_KEY = 'chirag-current-session-id';
const MAX_LOCAL_SESSIONS = 100;

function generateSessionId(): string {
  return `chat_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function loadLocalSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ChatSession[];
  } catch {
    return [];
  }
}

function saveLocalSessions(sessions: ChatSession[]): void {
  try {
    // Keep only the newest MAX_LOCAL_SESSIONS
    const trimmed = sessions.slice(0, MAX_LOCAL_SESSIONS);
    localStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify(trimmed),
    );
  } catch (e) {
    console.warn('[Chat] localStorage save failed:', e);
  }
}

function upsertLocalSession(session: ChatSession): void {
  const sessions = loadLocalSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.unshift(session);
  }
  saveLocalSessions(sessions);
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const {
    user: firebaseUser,
    puterUser,
    initialize,
    signInWithGoogle,
    signInWithPuter,
    signOut,
  } = useAuthStore();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedMode, _setSelectedMode] =
    useState<PersonalityMode>('professional');
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [signingIn, setSigningIn] = useState(false);
  const [_signInStep, setSignInStep] = useState<
    'none' | 'firebase' | 'puter' | 'done'
  >('none');
  const endRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  // Reload the history sidebar from localStorage
  // (merged with Firestore if signed in)
  const refreshHistory = useCallback(async () => {
    const localSessions = loadLocalSessions();

    if (firebaseUser) {
      try {
        const { getUserChatSessions } = await import(
          '../../lib/firebase'
        );
        const firestoreSessions: ChatSession[] =
          await getUserChatSessions(firebaseUser.uid);
        // Merge: local first, then Firestore-only (by id)
        const seenIds = new Set(
          localSessions.map((s) => s.id),
        );
        const merged = [
          ...localSessions,
          ...firestoreSessions.filter(
            (s) => !seenIds.has(s.id),
          ),
        ];
        // Sort newest-first
        merged.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime(),
        );
        if (mountedRef.current) setChatHistory(merged);
      } catch (err) {
        console.warn(
          '[Chat] Firestore history load failed, using local:',
          err,
        );
        if (mountedRef.current) setChatHistory(localSessions);
      }
    } else {
      if (mountedRef.current) setChatHistory(localSessions);
    }
  }, [firebaseUser]);

  useEffect(() => {
    mountedRef.current = true;
    initialize();

    // Auto-select largest free model if none selected
    if (!selectedModel) {
      const freeModels = MODEL_CATALOG.filter((m) => m.isFree);
      if (freeModels.length > 0) {
        const largest = freeModels.reduce((a, b) =>
          (a.paramSize || 0) >= (b.paramSize || 0) ? a : b,
        );
        setSelectedModel(largest.id);
      }
    }

    // Restore current session from localStorage
    try {
      const savedId = localStorage.getItem(CURRENT_SESSION_KEY);
      if (savedId) {
        const sessions = loadLocalSessions();
        const found = sessions.find((s) => s.id === savedId);
        if (found && found.messages.length > 0) {
          setCurrentSessionId(found.id);
          setMessages(found.messages);
        }
      }
    } catch {}

    return () => {
      mountedRef.current = false;
    };
  }, [initialize, selectedModel]);

  // Load history whenever firebase user changes or on mount
  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const modelOptions = [
    {
      value: '',
      label: 'Auto (Smart)',
      sub: 'Picks best Puter.js model for your query',
    },
    ...MODEL_CATALOG.map((m) => ({
      value: m.id,
      label: m.isFree ? `🆓 ${m.name}` : m.name,
      sub: m.isFree
        ? `FREE · Puter.js · ${m.params} — ${m.bestFor}`
        : `Puter.js · ${m.params} — ${m.bestFor}`,
      isFree: m.isFree,
    })),
  ];

  // Start a fresh conversation
  const handleNewChat = useCallback(() => {
    const newId = generateSessionId();
    setMessages([]);
    setCurrentSessionId(newId);
    try {
      localStorage.setItem(CURRENT_SESSION_KEY, newId);
    } catch {}
    setShowHistory(false);
  }, []);

  // Restore a session from the sidebar
  const handleRestoreSession = useCallback(
    (session: ChatSession) => {
      setMessages(session.messages);
      setCurrentSessionId(session.id);
      try {
        localStorage.setItem(CURRENT_SESSION_KEY, session.id);
      } catch {}
      setShowHistory(false);
    },
    [],
  );

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;

    // Ensure we have a session id
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = generateSessionId();
      setCurrentSessionId(sessionId);
      try {
        localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
      } catch {}
    }

    const userMsg: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    const assistantIdx = newMessages.length;
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        steps: [],
        streaming: true,
      },
    ]);

    // Immediately persist the user message to localStorage
    const sessionTitle =
      newMessages.length <= 1
        ? text.slice(0, 60) + (text.length > 60 ? '...' : '')
        : chatHistory.find((s) => s.id === sessionId)?.title ||
          text.slice(0, 60);
    const sessionSoFar: ChatSession = {
      id: sessionId,
      title: sessionTitle,
      messages: newMessages,
      createdAt:
        chatHistory.find((s) => s.id === sessionId)?.createdAt ||
        new Date().toISOString(),
    };
    upsertLocalSession(sessionSoFar);

    try {
      const history: ChatMessage[] = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }));

      // Fetch live data for AI context
      let liveCtx = '';
      try {
        const liveData = await fetchAllLiveData();
        liveCtx = buildLiveDataContext(liveData);
      } catch {
        // Proceed without live data
      }

      const stream = executeAgentStream(
        text.trim(),
        firebaseUser?.uid || 'anonymous',
        firebaseUser?.email || 'anonymous',
        firebaseUser?.displayName || 'Anonymous',
        window.location.pathname,
        selectedMode,
        selectedModel,
        history,
        liveCtx,
      );

      for await (const chunk of stream) {
        if (!mountedRef.current) break;
        if (chunk.type === 'step') {
          setMessages((prev) => {
            const updated = [...prev];
            const msg = { ...updated[assistantIdx]! };
            msg.steps = [...(msg.steps || []), chunk.content];
            updated[assistantIdx] = msg;
            return updated;
          });
        } else if (chunk.type === 'token') {
          setMessages((prev) => {
            const updated = [...prev];
            const msg = { ...updated[assistantIdx]! };
            msg.content += chunk.content;
            updated[assistantIdx] = msg;
            return updated;
          });
        } else if (chunk.type === 'done') {
          const finalAssistantMsg: Message = {
            role: 'assistant',
            content: chunk.content || '',
            timestamp: new Date().toISOString(),
            model: chunk.meta?.model,
            intent: chunk.meta?.intent,
            confidence: chunk.meta?.confidence,
            toolsUsed: chunk.meta?.toolsUsed,
            tier: chunk.meta?.tier,
            streaming: false,
          };

          setMessages((prev) => {
            const updated = [...prev];
            updated[assistantIdx] = finalAssistantMsg;
            return updated;
          });

          // Persist complete conversation to localStorage
          const completeMessages = [
            ...newMessages,
            finalAssistantMsg,
          ];
          const completeSession: ChatSession = {
            id: sessionId,
            title: sessionTitle,
            messages: completeMessages,
            createdAt: sessionSoFar.createdAt,
          };
          upsertLocalSession(completeSession);
          refreshHistory();

          // Also persist to Firestore if signed in
          if (firebaseUser) {
            try {
              const { saveChatSession } = await import(
                '../../lib/firebase'
              );
              await saveChatSession(
                firebaseUser.uid,
                sessionTitle,
                completeMessages,
                sessionId,
              );
            } catch (err) {
              console.error(
                '[Chat] Firestore save error (local ok):',
                err,
              );
            }
          }
        } else if (chunk.type === 'error') {
          setMessages((prev) => {
            const updated = [...prev];
            const msg = { ...updated[assistantIdx]! };
            msg.content = chunk.content;
            msg.streaming = false;
            updated[assistantIdx] = msg;
            return updated;
          });
        }
      }
    } catch (e) {
      console.error('Agent error:', e);
      setMessages((prev) => {
        const updated = [...prev];
        const msg = { ...updated[assistantIdx]! };
        msg.content = 'Unavailable.';
        msg.streaming = false;
        updated[assistantIdx] = msg;
        return updated;
      });
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const handleSignIn = async () => {
    setSigningIn(true);
    setSignInStep('firebase');
    try {
      await signInWithGoogle();
      setSignInStep('puter');
      await signInWithPuter();
      setSignInStep('done');
    } catch (e) {
      console.error('[ChatWrapper] Sign in error:', e);
      setSignInStep('done');
    } finally {
      if (mountedRef.current) setSigningIn(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#05050f]/80 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[85vh] min-h-[400px] max-h-[850px] rounded-2xl bg-[#12121e]/95 backdrop-blur-3xl border border-white/10 shadow-[var(--shadow-glow-teal)] flex overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* History Sidebar */}
        {showHistory && (
          <div className="w-64 border-r border-white/10 bg-[#0d0d17]/90 flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-white/10 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white/80">
                  History
                </span>
                <button
                  type="button"
                  onClick={() => setShowHistory(false)}
                  className="p-1 rounded text-white/40 hover:text-white"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <button
                type="button"
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--primary-light)] bg-[var(--primary-muted)] border border-[var(--primary-subtle)] hover:bg-[var(--primary-subtle)] transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {chatHistory.length === 0 ? (
                <div className="p-4 text-center text-white/40 text-xs">
                  No history yet
                </div>
              ) : (
                chatHistory.map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => handleRestoreSession(s)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs truncate transition-colors ${
                      s.id === currentSessionId
                        ? 'text-[var(--primary-light)] bg-[var(--primary-muted)]'
                        : 'text-white/70 hover:bg-white/5'
                    }`}
                  >
                    {s.title || 'New Chat'}
                    <div className="text-[10px] text-white/30 mt-0.5">
                      {new Date(s.createdAt).toLocaleDateString()} · {s.messages.length} msgs
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="p-3 border-t border-white/10 space-y-1">
              {firebaseUser && (
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="w-full px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Sign Out
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gradient-to-r from-[var(--primary-muted)] to-[var(--primary-faint)]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <div>
                <h2 className="text-sm font-bold text-white">Chirag AI</h2>
                <span className="text-[10px] text-white/40 uppercase tracking-widest truncate max-w-[120px]">
                  {selectedModel
                    ? MODEL_CATALOG.find((m) => m.id === selectedModel)
                        ?.name || 'AI Agent'
                    : 'Auto-Select'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Dropdown
                label={'Model'}
                options={modelOptions}
                value={selectedModel}
                onChange={setSelectedModel}
                width="w-80"
              />
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-white/40 hover:text-white"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
                <div className="h-20 w-20 rounded-3xl bg-[#1a1a2e] border border-[var(--primary-subtle)] flex items-center justify-center text-4xl shadow-xl shadow-[var(--shadow-glow-teal)] rotate-3">
                  ✨
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  {SUGGESTED.map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => handleSend(s)}
                      className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.07] text-xs text-white/60 hover:text-white text-left transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : ''}`}
              >
                {m.role === 'assistant' && (
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] flex items-center justify-center text-white shrink-0 mt-1">
                    AI
                  </div>
                )}
                <div
                  className={`max-w-[85%] space-y-2 ${m.role === 'user' ? 'text-right' : ''}`}
                >
                  <div
                    className={`px-4 py-3 rounded-2xl border text-sm leading-relaxed ${m.role === 'user' ? 'bg-[var(--primary-muted)] border-[var(--primary-subtle)] text-white' : 'bg-white/[0.03] border-white/5 text-white/90'}`}
                  >
                    <div
                      dangerouslySetInnerHTML={{ __html: renderMd(m.content) }}
                    />
                    {m.role === 'assistant' && m.streaming && !m.content && (
                      <span className="animate-pulse">...</span>
                    )}
                  </div>
                  {m.role === 'assistant' && m.steps && m.steps.length > 0 && (
                    <StepIndicator steps={m.steps} streaming={!!m.streaming} />
                  )}
                  {m.role === 'assistant' && m.model && (
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-[10px] text-white/30">
                        {m.model}
                      </span>
                      {m.intent && <IntentBadge intent={m.intent} />}
                      {m.confidence !== undefined && (
                        <ConfidenceBar confidence={m.confidence} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="p-4 sm:p-6 bg-[#0a0a14] border-t border-white/5">
            {(!firebaseUser || !puterUser) && (
              <div className="mb-4 p-4 rounded-2xl bg-gradient-to-br from-[var(--primary-muted)] to-[var(--primary-faint)] border border-[var(--primary-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[var(--shadow-glow-teal)]">
                <div className="flex flex-col items-start gap-1">
                  <div className="text-xs font-bold text-white/90">
                    {!firebaseUser && !puterUser
                      ? 'Dual Identity Required'
                      : !firebaseUser
                        ? 'Google Login Required'
                        : 'Puter.js Connection Required'}
                  </div>
                  <div className="text-[10px] text-white/50 leading-relaxed max-w-[300px]">
                    {!firebaseUser && !puterUser
                      ? 'Connect both Google (storage) and Puter.js (AI) for the full premium experience.'
                      : !firebaseUser
                        ? 'Sign in with Google to persist your chat history across devices.'
                        : 'Connect Puter.js to access advanced AI models and processing power.'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignIn}
                  disabled={signingIn}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[var(--primary)] to-[var(--primary-light)] text-black text-[11px] font-bold uppercase tracking-wider disabled:opacity-50 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[var(--shadow-glow-teal)]"
                >
                  {signingIn
                    ? `Connecting...`
                    : !firebaseUser && !puterUser
                      ? 'Connect Both'
                      : !firebaseUser
                        ? 'Login Google'
                        : 'Connect Puter.js'}
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit} className="relative group">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={loading ? 'Thinking...' : 'Ask me anything...'}
                className="w-full px-6 py-4 rounded-2xl bg-white/[0.04] border border-white/10 text-white text-sm"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="absolute right-2 top-2 bottom-2 px-5 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-light)] text-black font-bold text-sm disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root Export ────────────────────────────────────────────────────
export default function ChatWrapper() {
  const isOpen = useAIChatStore((s) => s.isOpen);
  const openChat = useAIChatStore((s) => s.openChat);
  const closeChat = useAIChatStore((s) => s.closeChat);

  if (isOpen) {
    return <ChatPanel onClose={closeChat} />;
  }
  return <DraggableButton onOpen={openChat} />;
}
