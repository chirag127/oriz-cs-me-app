import {
  type FirebaseApp,
  getApps as getFirebaseApps,
  initializeApp as firebaseInitializeApp,
} from 'firebase/app';
import type { initializeApp } from 'firebase/app';
import {
  type Auth,
  getAuth as firebaseGetAuthInstance,
} from 'firebase/auth';
import type { getAuth, User } from 'firebase/auth';
import {
  type Firestore,
  getFirestore as firebaseGetFirestoreInstance,
} from 'firebase/firestore';
import type { getFirestore, Timestamp } from 'firebase/firestore';

/*
 * Lazy-proxy auth + db (shared family pattern from oriz-home).
 *
 * The legacy ADMIN_EMAIL / saveChatMessage / phone-auth surface remains
 * in this file so the existing AuthBanner / ChatWidget / AdminDashboard
 * islands still compile. The new v2 chrome (AccountPanel + FinishSignIn
 * components below) reaches for `auth` and `db` directly via the proxy.
 *
 * The family Firebase project is `oriz-app` (auth.oriz.in). The legacy
 * widgets used a separate `chirag-127` project — that project remains the
 * default for the legacy flows so we don't break logged-in users mid-deploy.
 * The new v2 lazy proxy below targets the FAMILY project so a user signed in
 * across `oriz.in` is also signed in here.
 */

// Admin email
export const ADMIN_EMAIL = 'whyiswhen@gmail.com';

// Multiple admin emails support
export const ADMIN_EMAILS = ['whyiswhen@gmail.com', 'chirag127.in@gmail.com'];

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// Chat message types
export interface ChatMessage {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  message: string;
  timestamp: Timestamp | null;
  pageContext?: string;
}

// Lazy Firebase initialization - only on client side
let _app: ReturnType<typeof initializeApp> | null = null;
let _auth: ReturnType<typeof getAuth> | null = null;
let _db: ReturnType<typeof getFirestore> | null = null;

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBBEidXiLDhLumocfQuZAormy1_dFwL9EY',
  authDomain: 'chirag-127.firebaseapp.com',
  projectId: 'chirag-127',
  storageBucket: 'chirag-127.firebasestorage.app',
  messagingSenderId: '308014403143',
  appId: '1:308014403143:web:eb46f53b0943ece31f6b62',
  measurementId: 'G-JW4RXZGMZ9',
};

async function getFirebaseApp() {
  if (_app) return _app;
  if (typeof window === 'undefined')
    throw new Error('Firebase can only be used on the client side');

  const {
    initializeApp: firebaseInitializeApp,
    getApps: firebaseGetApps,
    getApp: firebaseGetApp,
  } = await import('firebase/app');
  _app =
    firebaseGetApps().length === 0
      ? firebaseInitializeApp(FIREBASE_CONFIG)
      : firebaseGetApp();
  return _app;
}

export async function getFirebaseAuth() {
  if (_auth) return _auth;
  const app = await getFirebaseApp();
  const { getAuth: firebaseGetAuth } = await import('firebase/auth');
  _auth = firebaseGetAuth(app);
  return _auth;
}

export async function getFirebaseDb() {
  if (_db) return _db;
  const app = await getFirebaseApp();
  const { getFirestore: firebaseGetFirestore } = await import(
    'firebase/firestore'
  );
  _db = firebaseGetFirestore(app);
  return _db;
}

// Phone auth
let _recaptchaVerifier: any = null;

export async function initRecaptchaVerifier(
  containerOrButtonId: string,
  size: 'invisible' | 'normal' = 'invisible',
): Promise<any> {
  const { RecaptchaVerifier } = await import('firebase/auth');
  const auth = await getFirebaseAuth();
  if (_recaptchaVerifier) {
    _recaptchaVerifier.clear();
    _recaptchaVerifier = null;
  }
  _recaptchaVerifier = new RecaptchaVerifier(auth, containerOrButtonId, {
    size,
    callback: () => {},
    'expired-callback': () => {
      _recaptchaVerifier = null;
    },
  });
  return _recaptchaVerifier;
}

export async function signInWithPhone(
  phoneNumber: string,
  appVerifier: any,
): Promise<{ confirm: (code: string) => Promise<User | null> } | null> {
  const { signInWithPhoneNumber: firebaseSignInWithPhoneNumber } = await import(
    'firebase/auth'
  );
  const auth = await getFirebaseAuth();
  const confirmationResult = await firebaseSignInWithPhoneNumber(
    auth,
    phoneNumber,
    appVerifier,
  );
  return {
    confirm: async (code: string) => {
      const result = await confirmationResult.confirm(code);
      return result.user;
    },
  };
}

export async function clearRecaptcha(): Promise<void> {
  if (_recaptchaVerifier) {
    _recaptchaVerifier.clear();
    _recaptchaVerifier = null;
  }
}

// Auth functions
export async function signInWithGoogle(): Promise<User | null> {
  const {
    GoogleAuthProvider,
    signInWithPopup,
    browserLocalPersistence,
    setPersistence,
  } = await import('firebase/auth');

  const auth = await getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');

  // Explicitly set persistence to ensure it holds across sessions
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (e) {
    console.warn('[Firebase] setPersistence error:', e);
  }

  // On localhost, popup is generally more reliable and avoids redirect loops/IndexedDB issues
  try {
    console.log('[Firebase] Triggering signInWithPopup...');
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (e: any) {
    console.error('[Firebase] Popup sign-in error:', e?.code, e?.message);
    throw e;
  }
}

export async function handleGoogleRedirect(): Promise<User | null> {
  const { getRedirectResult } = await import('firebase/auth');
  const auth = await getFirebaseAuth();
  try {
    console.log('[Firebase] Calling getRedirectResult...');
    const result = await getRedirectResult(auth);
    if (result) {
      console.log(
        '[Firebase] Redirect result found for user:',
        result.user.email,
      );
      return result.user;
    }
    console.log('[Firebase] No redirect result found.');
    return null;
  } catch (e: any) {
    console.error('[Firebase] getRedirectResult error:', e?.code, e?.message);
    return null;
  }
}

export async function signOut(): Promise<void> {
  const { signOut: firebaseSignOut } = await import('firebase/auth');
  const auth = await getFirebaseAuth();
  await firebaseSignOut(auth);
}

export function isAdmin(user: User | null): boolean {
  return isAdminEmail(user?.email);
}

export async function saveChatMessage(
  userId: string,
  userEmail: string,
  userName: string,
  message: string,
  pageContext?: string,
): Promise<string> {
  const { collection, addDoc, serverTimestamp } = await import(
    'firebase/firestore'
  );
  const db = await getFirebaseDb();
  const docRef = await addDoc(collection(db, 'chatMessages'), {
    userId,
    userEmail,
    userName,
    message,
    pageContext: pageContext || '/',
    timestamp: serverTimestamp(),
  });
  return docRef.id;
}

export async function getUserChatSessions(userId: string): Promise<any[]> {
  try {
    const { collection, query, orderBy, limit, where, getDocs } = await import(
      'firebase/firestore'
    );
    const db = await getFirebaseDb();
    const q = query(
      collection(db, 'chatSessions'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (err: any) {
    if (err?.message?.includes('index')) {
      console.warn(
        '[Firebase] Chat history index is still building. History will be available soon.',
      );
      return [];
    }
    console.error('[Firebase] Failed to get chat sessions:', err);
    throw err;
  }
}

export async function saveChatSession(
  userId: string,
  title: string,
  messages: any[],
  sessionId?: string,
): Promise<string> {
  const { collection, addDoc, doc, setDoc, serverTimestamp } =
    await import('firebase/firestore');
  const db = await getFirebaseDb();

  if (sessionId) {
    // Update existing session doc in-place
    const docRef = doc(db, 'chatSessions', sessionId);
    await setDoc(
      docRef,
      {
        userId,
        title,
        messages,
        createdAt: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return sessionId;
  }

  // Fallback: create new if no sessionId given
  const docRef = await addDoc(
    collection(db, 'chatSessions'),
    {
      userId,
      title,
      messages,
      createdAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    },
  );
  return docRef.id;
}

export async function getOnAuthStateChanged() {
  const { onAuthStateChanged } = await import('firebase/auth');
  return onAuthStateChanged;
}

export async function getAuthInstance() {
  return getFirebaseAuth();
}

export async function subscribeToChatMessages(
  callback: (messages: ChatMessage[]) => void,
  messageLimit: number = 100,
) {
  const {
    collection,
    query,
    orderBy,
    limit: firestoreLimit,
    onSnapshot,
  } = await import('firebase/firestore');
  const db = await getFirebaseDb();
  const q = query(
    collection(db, 'chatMessages'),
    orderBy('timestamp', 'desc'),
    firestoreLimit(messageLimit),
  );
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ChatMessage[];
    callback(messages);
  });
}

export type { User };

// ── Family lazy-proxy auth + db (oriz-app project) ─────────────────────
//
// Mirrors oriz-home/src/lib/firebase.ts. Sites in the family share Firebase
// project `oriz-app` so a user signed in on oriz.in is signed in everywhere.
//
// Lazy via Proxy so server-side prerender of pages that import this module
// never crashes — Firebase is only touched once a property is read in the
// browser.

const FAMILY_FIREBASE_CONFIG = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
};

let _familyApp: FirebaseApp | null = null;
let _familyAuth: Auth | null = null;
let _familyDb: Firestore | null = null;

function getFamilyApp(): FirebaseApp {
  if (_familyApp) return _familyApp;
  // Family app is named so it doesn't collide with the legacy chirag-127
  // default app initialized via async getFirebaseApp() above.
  const existing = getFirebaseApps().find((a) => a.name === 'oriz-family');
  _familyApp =
    existing ??
    firebaseInitializeApp(FAMILY_FIREBASE_CONFIG, 'oriz-family');
  return _familyApp;
}

export const auth: Auth = new Proxy({} as Auth, {
  get(_t, p) {
    if (!_familyAuth) _familyAuth = firebaseGetAuthInstance(getFamilyApp());
    return Reflect.get(_familyAuth, p);
  },
}) as Auth;

export const familyDb: Firestore = new Proxy({} as Firestore, {
  get(_t, p) {
    if (!_familyDb) _familyDb = firebaseGetFirestoreInstance(getFamilyApp());
    return Reflect.get(_familyDb, p);
  },
}) as Firestore;

