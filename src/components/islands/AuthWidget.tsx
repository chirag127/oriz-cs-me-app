import { useEffect, useState } from 'react';
import { useAuthStore } from '../../lib/authStore';
import { isAdminEmail } from '../../lib/firebase';

export default function AuthWidget() {
  const {
    user,
    puterUser,
    loading,
    initialize,
    signInWithGoogle,
    signInWithPuter,
    signOut,
  } = useAuthStore();

  const [showDropdown, setShowDropdown] = useState(false);
  const [signingIn, setSigningIn] = useState<'google' | 'puter' | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleGoogleSignIn = async () => {
    setSigningIn('google');
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('[AuthWidget] Google sign in error:', err);
    } finally {
      setSigningIn(null);
    }
  };

  const handlePuterSignIn = async () => {
    setSigningIn('puter');
    try {
      await signInWithPuter();
    } catch (err) {
      console.error('[AuthWidget] Puter sign in error:', err);
    } finally {
      setSigningIn(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setShowDropdown(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-1 pr-3 rounded-xl bg-white/5 border border-white/10 animate-pulse">
        <div className="h-7 w-7 rounded-lg bg-white/10" />
        <div className="h-3 w-16 bg-white/10 rounded" />
      </div>
    );
  }

  if (user || puterUser) {
    const isBoth = user && puterUser;

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowDropdown(!showDropdown)}
          className={`flex items-center gap-2 p-1 pr-3 rounded-xl border transition-all active:scale-95 ${isBoth ? 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]' : 'bg-white/5 border-white/10'}`}
        >
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="h-7 w-7 rounded-lg object-cover"
            />
          ) : (
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold shadow-inner">
              {(user?.displayName ||
                user?.email ||
                puterUser?.username ||
                'U')[0]!.toUpperCase()}
            </div>
          )}
          <div className="flex flex-col items-start px-0.5">
            <span className="text-[11px] font-bold text-white/90 leading-tight">
              {user?.displayName?.split(' ')[0] ||
                puterUser?.username ||
                'User'}
            </span>
            <div className="flex items-center gap-1.5 mt-1">
              <div
                className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${user ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]' : 'bg-white/10'}`}
                title={user ? `Google: ${user.email}` : 'Google: Not Connected'}
              />
              <div
                className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${puterUser ? 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'bg-white/10'}`}
                title={
                  puterUser
                    ? `Puter: ${puterUser.username}`
                    : 'Puter: Not Connected'
                }
              />
              {!isBoth && (
                <div className="text-[9px] text-white/30 font-medium ml-1 flex items-center gap-1">
                  <span className="h-1 w-1 rounded-full bg-amber-500/50 animate-pulse" />
                  Connect Both
                </div>
              )}
            </div>
          </div>
        </button>

        {showDropdown && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowDropdown(false)}
            />
            <div className="absolute right-0 top-full mt-2 w-64 p-2 rounded-2xl bg-[#0a0a0f]/95 backdrop-blur-2xl border border-white/10 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-3 py-3 border-b border-white/5 mb-1 bg-white/2 rounded-t-xl">
                <p className="text-xs font-bold text-white truncate">
                  {user?.email || puterUser?.username}
                </p>
                <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">
                  Dual Session Profile
                </p>
              </div>

              <div className="p-1 space-y-1">
                {!user && (
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    className="flex items-center gap-3 w-full px-3 py-2 text-xs text-white/70 hover:bg-white/5 rounded-lg transition-all group"
                  >
                    <div className="h-6 w-6 rounded bg-white/5 flex items-center justify-center group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors font-bold">
                      G
                    </div>
                    Connect Google
                  </button>
                )}
                {!puterUser && (
                  <button
                    type="button"
                    onClick={handlePuterSignIn}
                    className="flex items-center justify-between w-full px-3 py-2.5 text-xs text-cyan-400 bg-cyan-400/5 hover:bg-cyan-400/10 rounded-xl transition-all group border border-cyan-400/20 mb-1"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-6 rounded bg-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold">
                        P
                      </div>
                      <div className="flex flex-col items-start">
                        <span className="font-bold">Connect Puter.js</span>
                        <span className="text-[9px] text-cyan-400/50">
                          Required for AI Models
                        </span>
                      </div>
                    </div>
                    <svg
                      className="h-4 w-4 opacity-50 group-hover:translate-x-0.5 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                )}

                {isAdminEmail(user?.email) && (
                  <a
                    href="/system/admin"
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-xs text-amber-400 hover:bg-amber-400/10 rounded-xl transition-all font-bold"
                  >
                    <span>Admin Terminal</span>
                  </a>
                )}

                <div className="h-px bg-white/5 my-2" />
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-3 w-full px-3 py-2 text-xs text-red-400 hover:bg-red-400/10 rounded-lg transition-all group"
                >
                  <svg
                    className="h-4 w-4 opacity-50 group-hover:opacity-100"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Sign Out Everywhere
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={!!signingIn}
        className="group relative flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 transition-all border border-indigo-500/20 disabled:opacity-50 active:scale-95"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
          Google Login
        </span>
      </button>
      <button
        type="button"
        onClick={handlePuterSignIn}
        disabled={!!signingIn}
        className="group relative flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 transition-all border border-cyan-500/20 disabled:opacity-50 active:scale-95"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">
          Connect Puter
        </span>
      </button>
    </div>
  );
}
