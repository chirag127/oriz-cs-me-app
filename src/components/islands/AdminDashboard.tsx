import { useCallback, useEffect, useState } from 'react';
import {
  type ChatDocument,
  getAllMediaOverview,
  type QueryDocument,
  resolveUnknownQuery,
  subscribeToChats,
  subscribeToQueries,
  subscribeToUnknownQueries,
  subscribeToVisitors,
  type UnknownQueryDocument,
  type VisitorDocument,
} from '../../lib/ai/store';
import { useAuthStore } from '../../lib/authStore';
import { isAdminEmail } from '../../lib/firebase';

type Tab = 'overview' | 'chats' | 'queries' | 'unknown' | 'visitors' | 'media';

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}
        >
          {icon}
        </div>
        <span className="text-sm text-white/40">{label}</span>
      </div>
      <p className="text-3xl font-bold text-white font-display">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function IntentBadge({ intent }: { intent: string }) {
  const colors: Record<string, string> = {
    career: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
    coding: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    projects: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
    skills: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    movies: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
    music: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
    books: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
    anime: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/20',
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
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-white/30 w-8 text-right">{pct}%</span>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function AdminDashboard() {
  const {
    user,
    puterUser,
    loading,
    isAuthorized,
    isFullyConnected,
    initialize,
    signInWithGoogle,
    signInWithPuter,
    signOut,
  } = useAuthStore();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [chats, setChats] = useState<ChatDocument[]>([]);
  const [queries, setQueries] = useState<QueryDocument[]>([]);
  const [unknownQueries, setUnknownQueries] = useState<UnknownQueryDocument[]>(
    [],
  );
  const [visitors, setVisitors] = useState<VisitorDocument[]>([]);
  const [media, setMedia] = useState<Record<string, any>>({});
  const [expandedChat, setExpandedChat] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState('');
  const [querySearch, setQuerySearch] = useState('');

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isAuthorized) return;
    const unsubs: (() => void)[] = [];

    (async () => {
      const u1 = await subscribeToChats(setChats);
      unsubs.push(u1);
      const u2 = await subscribeToQueries(setQueries);
      unsubs.push(u2);
      const u3 = await subscribeToUnknownQueries(setUnknownQueries);
      unsubs.push(u3);
      const u4 = await subscribeToVisitors(setVisitors);
      unsubs.push(u4);
      setMedia(await getAllMediaOverview());
    })();

    return () => {
      unsubs.forEach((u) => {
        u();
      });
    };
  }, [isAuthorized]);

  const handleResolve = useCallback(async (docId: string) => {
    const notes = prompt('Admin notes (optional):');
    await resolveUnknownQuery(docId, notes || undefined);
  }, []);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign in failed:', err);
    }
  };

  const handlePuterSignIn = async () => {
    try {
      await signInWithPuter();
    } catch (err) {
      console.error('Puter sign in failed:', err);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-xl border-2 border-white/10 border-t-amber-400 animate-spin" />
          <p className="text-sm text-white/30">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    const isFirebaseAdmin = isAdminEmail(user?.email);
    const hasPuter = !!puterUser;

    return (
      <div className="flex flex-col items-center justify-center py-20 px-4">
        <div className="w-full max-w-md overflow-hidden rounded-3xl bg-[#0a0a0f]/80 backdrop-blur-2xl border border-white/5 shadow-2xl">
          <div className="relative h-32 bg-gradient-to-br from-indigo-600/20 to-cyan-500/20 flex items-center justify-center border-b border-white/5">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
            <div className="relative flex items-center gap-4">
              <div
                className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${user ? 'bg-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'bg-white/5 border border-white/10 opacity-40'}`}
              >
                <span className="text-xl font-bold text-white">G</span>
              </div>
              <div className="h-px w-8 bg-white/10" />
              <div
                className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${hasPuter ? 'bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'bg-white/5 border border-white/10 opacity-40'}`}
              >
                <span className="text-xl font-bold text-white">P</span>
              </div>
            </div>
          </div>

          <div className="p-8 text-center">
            <h2
              className="text-2xl font-bold text-white mb-2"
              style={{ fontFamily: 'Outfit, sans-serif' }}
            >
              {isFullyConnected ? 'Unauthorized' : 'Terminal Access Restricted'}
            </h2>
            <p className="text-sm text-white/40 mb-8 max-w-[280px] mx-auto">
              {isFullyConnected
                ? 'Your connections are established, but you do not have administrative privileges.'
                : 'Please initialize both security layers to access administrative functions.'}
            </p>

            <div className="space-y-3">
              {!user ? (
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="w-full py-4 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  <span className="text-sm">Connect Google Login</span>
                </button>
              ) : (
                <div
                  className={`w-full py-4 px-6 rounded-2xl border text-sm font-medium flex items-center justify-center gap-3 ${isFirebaseAdmin ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {isFirebaseAdmin
                    ? 'Google Identity Verified'
                    : `Unauthorized (${user.email})`}
                </div>
              )}

              {!hasPuter ? (
                <button
                  type="button"
                  onClick={handlePuterSignIn}
                  className="w-full py-4 px-6 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                  <span className="text-sm">Connect Puter Cloud</span>
                </button>
              ) : (
                <div className="w-full py-4 px-6 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm font-medium flex items-center justify-center gap-3">
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Puter Connection Established
                </div>
              )}

              {/* Removed the old unauthorized message block */}

              {isFullyConnected && ( // Changed condition to show sign out when fully connected but unauthorized
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="mt-6 p-2 text-[10px] text-white/20 hover:text-white/40 transition-colors uppercase tracking-[0.2em] font-bold border-t border-white/5 w-full pt-4"
                >
                  Reset Sessions
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const unresolvedUnknown = unknownQueries.filter((q) => !q.resolved).length;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'chats', label: 'Chats', count: chats.length },
    { id: 'queries', label: 'Queries', count: queries.length },
    { id: 'unknown', label: 'Unknown', count: unresolvedUnknown },
    { id: 'visitors', label: 'Visitors', count: visitors.length },
    { id: 'media', label: 'Media', count: Object.keys(media).length },
  ];

  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).filter((k) => k !== 'messages');
    const csvRows = [headers.join(',')];
    for (const row of data) {
      csvRows.push(
        headers
          .map((h) => {
            const val = row[h] === undefined ? '' : String(row[h]);
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(','),
      );
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredChats = chats.filter(
    (c) =>
      c.userEmail.toLowerCase().includes(chatSearch.toLowerCase()) ||
      (c.userName || '').toLowerCase().includes(chatSearch.toLowerCase()),
  );

  const filteredQueries = queries.filter(
    (q) =>
      q.query.toLowerCase().includes(querySearch.toLowerCase()) ||
      (q.userName || '').toLowerCase().includes(querySearch.toLowerCase()) ||
      q.intent.toLowerCase().includes(querySearch.toLowerCase()),
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white font-display">
            Dashboard
          </h1>
          <p className="text-sm text-white/40 mt-1">
            Real-time Firestore analytics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">Live</span>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="px-3 py-1.5 text-sm text-white/40 hover:text-white/70 rounded-lg hover:bg-white/5 transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white/[0.06] text-white'
                : 'text-white/30 hover:text-white/60 hover:bg-white/[0.03]'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-md ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-white/60'
                    : 'bg-white/5 text-white/20'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Visitors"
              value={visitors.length}
              color="bg-sky-500/10"
              icon={
                <svg
                  className="h-5 w-5 text-sky-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                  />
                </svg>
              }
            />
            <StatCard
              label="Chat Sessions"
              value={chats.length}
              color="bg-violet-500/10"
              icon={
                <svg
                  className="h-5 w-5 text-violet-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
                  />
                </svg>
              }
            />
            <StatCard
              label="Total Queries"
              value={queries.length}
              color="bg-amber-500/10"
              icon={
                <svg
                  className="h-5 w-5 text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                  />
                </svg>
              }
            />
            <StatCard
              label="Unknown Queries"
              value={unresolvedUnknown}
              color="bg-red-500/10"
              icon={
                <svg
                  className="h-5 w-5 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                  />
                </svg>
              }
            />
          </div>

          {/* Recent activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="text-sm font-semibold text-white/60 mb-4">
                Recent Queries
              </h3>
              <div className="space-y-3">
                {queries.slice(0, 5).map((q, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-xs text-white/30 shrink-0 mt-0.5">
                      {(q.userName || '?')[0]!.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white/70 truncate">
                        {q.query}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <IntentBadge intent={q.intent} />
                        <span className="text-[11px] text-white/20">
                          {timeAgo(q.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {queries.length === 0 && (
                  <p className="text-sm text-white/20 text-center py-4">
                    No queries yet
                  </p>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
              <h3 className="text-sm font-semibold text-white/60 mb-4">
                Recent Visitors
              </h3>
              <div className="space-y-3">
                {visitors.slice(0, 5).map((v, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-xs text-white/30 shrink-0">
                      {(v.userName || '?')[0]!.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white/70 truncate">
                        {v.userEmail || 'Anonymous'}
                      </p>
                      <p className="text-[11px] text-white/20">
                        {v.totalQueries} queries &middot; {v.visitCount} visits
                        &middot; {timeAgo(v.lastVisit)}
                      </p>
                    </div>
                  </div>
                ))}
                {visitors.length === 0 && (
                  <p className="text-sm text-white/20 text-center py-4">
                    No visitors yet
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chats Tab */}
      {activeTab === 'chats' && (
        <div className="space-y-3">
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="Search chats by name or email..."
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500/40"
            />
            <button
              type="button"
              onClick={() => exportCSV(filteredChats, 'chats_export.csv')}
              className="px-4 py-2 rounded-xl bg-violet-500/20 text-violet-400 text-sm font-medium hover:bg-violet-500/30 transition-colors"
            >
              Export CSV
            </button>
          </div>
          {filteredChats.length === 0 && (
            <div className="text-center py-16 text-white/20">
              No chat sessions found
            </div>
          )}
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedChat(expandedChat === chat.id! ? null : chat.id!)
                }
                className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-sm font-bold text-violet-400 shrink-0">
                    {(chat.userName || '?')[0]!.toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {chat.userName || 'Unknown'}
                    </p>
                    <p className="text-xs text-white/30 truncate">
                      {chat.userEmail}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <p className="text-xs text-white/40">
                      {chat.messageCount} messages
                    </p>
                    <p className="text-[11px] text-white/20">
                      {timeAgo(chat.lastMessageAt)}
                    </p>
                  </div>
                  <svg
                    className={`h-4 w-4 text-white/20 transition-transform ${expandedChat === chat.id! ? 'rotate-180' : ''}`}
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
                </div>
              </button>
              {expandedChat === chat.id! && (
                <div className="border-t border-white/[0.06] p-5 space-y-4 bg-white/[0.01]">
                  <div className="flex items-center gap-4 text-xs text-white/30">
                    <span>Page: {chat.pageContext}</span>
                    <span>
                      Started: {new Date(chat.startedAt).toLocaleString()}
                    </span>
                    <span>
                      Last: {new Date(chat.lastMessageAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {chat.messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex gap-3 ${msg.role === 'user' ? '' : 'pl-6'}`}
                      >
                        <div
                          className={`h-7 w-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
                            msg.role === 'user'
                              ? 'bg-sky-500/10 text-sky-400'
                              : 'bg-amber-500/10 text-amber-400'
                          }`}
                        >
                          {msg.role === 'user' ? 'U' : 'AI'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white/70 whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-white/15">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                            {msg.model && (
                              <span className="text-[10px] text-white/15">
                                {msg.model}
                              </span>
                            )}
                            {msg.intent && <IntentBadge intent={msg.intent} />}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Queries Tab */}
      {activeTab === 'queries' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Search queries by text, user, or intent..."
              value={querySearch}
              onChange={(e) => setQuerySearch(e.target.value)}
              className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-500/40"
            />
            <button
              type="button"
              onClick={() => exportCSV(filteredQueries, 'queries_export.csv')}
              className="px-4 py-2 rounded-xl bg-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/30 transition-colors"
            >
              Export CSV
            </button>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">
                      User
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">
                      Query
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">
                      Intent
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">
                      Confidence
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">
                      Model
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredQueries.map((q, i) => (
                    <tr
                      key={i}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center text-[11px] text-white/30">
                            {(q.userName || '?')[0]!.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs text-white/60 truncate max-w-[120px]">
                              {q.userName || 'Anonymous'}
                            </p>
                            <p className="text-[10px] text-white/20 truncate max-w-[120px]">
                              {q.userEmail}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-white/60 truncate" title={q.query}>
                          {q.query}
                        </p>
                        <p
                          className="text-[10px] text-white/20 truncate mt-0.5"
                          title={q.response}
                        >
                          {q.response?.substring(0, 80)}...
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <IntentBadge intent={q.intent} />
                      </td>
                      <td className="px-4 py-3 w-28">
                        <ConfidenceBar confidence={q.confidence} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-white/30">
                        {q.model}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-white/20">
                        {timeAgo(q.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {queries.length === 0 && (
              <div className="text-center py-16 text-white/20">
                No queries recorded yet
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unknown Queries Tab */}
      {activeTab === 'unknown' && (
        <div className="space-y-3">
          {unknownQueries.length === 0 && (
            <div className="text-center py-16 text-white/20">
              No unknown queries
            </div>
          )}
          {unknownQueries.map((q) => (
            <div
              key={q.id}
              className={`rounded-2xl border p-5 ${
                q.resolved
                  ? 'border-white/[0.04] bg-white/[0.01]'
                  : 'border-red-500/10 bg-red-500/[0.02]'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-md ${
                        q.resolved
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-red-500/15 text-red-400'
                      }`}
                    >
                      {q.resolved ? 'RESOLVED' : 'UNRESOLVED'}
                    </span>
                    <span className="text-xs text-white/20">
                      {timeAgo(q.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-white/70 mb-2">{q.query}</p>
                  <p className="text-xs text-white/30 mb-2">{q.response}</p>
                  <div className="flex items-center gap-3 text-[11px] text-white/20">
                    <span>{q.userName || 'Anonymous'}</span>
                    <span>{q.userEmail}</span>
                    <span>Page: {q.pageContext}</span>
                  </div>
                  {q.adminNotes && (
                    <div className="mt-2 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                      <p className="text-xs text-amber-400/60">
                        Admin notes: {q.adminNotes}
                      </p>
                    </div>
                  )}
                </div>
                {!q.resolved && (
                  <button
                    type="button"
                    onClick={() => handleResolve(q.id!)}
                    className="shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                  >
                    Mark Resolved
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Visitors Tab */}
      {activeTab === 'visitors' && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">
                    Visitor
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">
                    Visits
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">
                    Queries
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">
                    Pages
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">
                    First Visit
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-white/30 uppercase tracking-wider">
                    Last Visit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {visitors.map((v, i) => (
                  <tr
                    key={i}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                            v.isAnonymous
                              ? 'bg-white/5 text-white/20'
                              : 'bg-sky-500/10 text-sky-400'
                          }`}
                        >
                          {(v.userName || '?')[0]!.toUpperCase()}
                        </div>
                        <span className="text-xs text-white/60">
                          {v.userName || 'Anonymous'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/30">
                      {v.userEmail || '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/60">
                      {v.visitCount}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/60">
                      {v.totalQueries}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {v.pagesVisited?.slice(0, 4).map((p, j) => (
                          <span
                            key={j}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/30"
                          >
                            {p}
                          </span>
                        ))}
                        {(v.pagesVisited?.length || 0) > 4 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/20">
                            +{v.pagesVisited.length - 4}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/20 whitespace-nowrap">
                      {v.firstVisit
                        ? new Date(v.firstVisit).toLocaleDateString()
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-white/20 whitespace-nowrap">
                      {timeAgo(v.lastVisit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visitors.length === 0 && (
            <div className="text-center py-16 text-white/20">
              No visitors recorded yet
            </div>
          )}
        </div>
      )}

      {/* Media Tab */}
      {activeTab === 'media' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(media).map(([category, data]) => (
            <div
              key={category}
              className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5"
            >
              <h3 className="text-lg font-bold text-amber-400 capitalize mb-3">
                {category} Data
              </h3>
              <div className="h-48 overflow-y-auto rounded-lg bg-black/40 p-3">
                <pre className="text-[10px] text-white/50 w-full overflow-x-hidden whitespace-pre-wrap">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </div>
            </div>
          ))}
          {Object.keys(media).length === 0 && (
            <div className="col-span-full text-center py-16 text-white/40">
              No media documents found in Firestore cache. Ensure GitHub Actions
              cron ran `fetch-data.ts`.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
