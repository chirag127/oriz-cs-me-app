import { create } from 'zustand';
import {
  signOut as firebaseSignOut,
  getAuthInstance,
  getOnAuthStateChanged,
  handleGoogleRedirect,
  isAdminEmail,
  signInWithGoogle,
  type User,
} from './firebase';

interface AuthState {
  user: User | null;
  puterUser: { username: string } | null;
  loading: boolean;
  initialized: boolean;
  isAuthorized: boolean; // Specifically for ADMIN access
  isFullyConnected: boolean; // Both Firebase and Puter connected
  setUser: (user: User | null) => void;
  setPuterUser: (user: { username: string } | null) => void;
  initialize: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithPuter: () => Promise<void>;
  signOut: () => Promise<void>;
}

// Module-level promise to ensure strict singleton initialization
let initializationPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  puterUser: null,
  loading: true,
  initialized: false,
  isAuthorized: false,
  isFullyConnected: false,

  setUser: (user) => {
    const puterUser = get().puterUser;
    const isFullyConnected = !!user && !!puterUser;
    const isAuthorized = isAdminEmail(user?.email) && !!puterUser;
    set({ user, isFullyConnected, isAuthorized });
  },

  setPuterUser: (puterUser) => {
    const user = get().user;
    const isFullyConnected = !!user && !!puterUser;
    const isAuthorized = isAdminEmail(user?.email) && !!puterUser;
    set({ puterUser, isFullyConnected, isAuthorized });
  },

  initialize: async () => {
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
      if (get().initialized) return;

      console.log('[AuthStore] Starting robust singleton initialization...');

      // 1. Handle Redirect Result FIRST (Crucial for Firebase)
      // This MUST happen exactly once per page load to capture the token
      try {
        console.log('[AuthStore] Checking for Firebase redirect result...');
        const redirectUser = await handleGoogleRedirect();
        if (redirectUser) {
          console.log('[AuthStore] Found redirect user:', redirectUser.email);
          const pUser = get().puterUser;
          set({
            user: redirectUser,
            isAuthorized: isAdminEmail(redirectUser.email) && !!pUser,
            isFullyConnected: !!pUser,
          });
        }
      } catch (e) {
        console.error('[AuthStore] Redirect check error:', e);
      }

      // 2. Subscribe to Firebase Auth State changes
      try {
        const auth = await getAuthInstance();
        const onAuthStateChanged = await getOnAuthStateChanged();

        onAuthStateChanged(auth, (currentUser) => {
          console.log(
            '[AuthStore] Firebase state change:',
            currentUser?.email || 'null',
          );
          const pUser = get().puterUser;
          set({
            user: currentUser,
            loading: false,
            initialized: true,
            isAuthorized: isAdminEmail(currentUser?.email) && !!pUser,
            isFullyConnected: !!currentUser && !!pUser,
          });
        });
      } catch (e) {
        console.error('[AuthStore] Firebase subscription error:', e);
        set({ loading: false, initialized: true });
      }

      // 3. Puter.js Integration
      const checkPuter = async () => {
        const w = window as any;
        if (w.puter?.auth) {
          try {
            if (w.puter.auth.isSignedIn()) {
              const pUser = await w.puter.auth.getUser();
              console.log(
                '[AuthStore] Puter session detected:',
                pUser?.username,
              );
              const fbUser = get().user;
              set({
                puterUser: { username: pUser.username },
                isAuthorized: isAdminEmail(fbUser?.email) && !!pUser,
                isFullyConnected: !!fbUser && !!pUser,
              });
            } else {
              console.log('[AuthStore] No Puter session found');
            }
          } catch (e) {
            console.error('[AuthStore] Puter session check error:', e);
          }
        }
      };

      // Poll for Puter.js readiness. Was 1s × 16 attempts (16s wall) which
      // is painful when puter.com is unreachable on the user's network. Now
      // 250ms × 12 (3s ceiling), and we short-circuit when navigator.onLine
      // reports offline since the SDK script can't have loaded then.
      const PUTER_POLL_MS = 250;
      const PUTER_MAX_ATTEMPTS = 12; // 3s total

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        console.log('[AuthStore] Offline — skipping Puter.js detection.');
        return;
      }

      let attempts = 0;
      const interval = setInterval(() => {
        const w = window as any;
        if (w.puter) {
          checkPuter();
          clearInterval(interval);
        } else if (attempts++ >= PUTER_MAX_ATTEMPTS) {
          console.log(
            `[AuthStore] Puter.js not found after ${(PUTER_MAX_ATTEMPTS * PUTER_POLL_MS) / 1000}s — continuing without it.`,
          );
          clearInterval(interval);
        }
      }, PUTER_POLL_MS);
    })();

    return initializationPromise;
  },

  signInWithGoogle: async () => {
    console.log('[AuthStore] Triggering Google Sign In...');
    const fbUser = await signInWithGoogle();
    if (fbUser) {
      console.log('[AuthStore] Google Sign In success (direct):', fbUser.email);
      const pUser = get().puterUser;
      set({
        user: fbUser,
        isAuthorized: isAdminEmail(fbUser.email) && !!pUser,
        isFullyConnected: !!pUser,
      });
    }
  },

  signInWithPuter: async () => {
    const w = window as any;
    if (w.puter?.auth) {
      if (!w.puter.auth.isSignedIn()) {
        await w.puter.auth.signIn();
      }
      const pUser = await w.puter.auth.getUser();
      if (pUser) {
        const fbUser = get().user;
        set({
          puterUser: { username: pUser.username },
          isAuthorized: isAdminEmail(fbUser?.email) && !!pUser,
          isFullyConnected: !!fbUser && !!pUser,
        });
      }
    }
  },

  signOut: async () => {
    console.log('[AuthStore] Global Sign Out...');
    try {
      await firebaseSignOut();
      const w = window as any;
      if (w.puter?.auth?.isSignedIn()) {
        w.puter.auth.signOut();
      }
      set({
        user: null,
        puterUser: null,
        isAuthorized: false,
        isFullyConnected: false,
      });
      console.log('[AuthStore] All sessions cleared');
    } catch (e) {
      console.error('[AuthStore] Sign out error:', e);
    }
  },
}));
