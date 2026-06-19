import { ADMIN_EMAIL, getFirebaseDb } from '../firebase';

// Collection names
export const COLLECTIONS = {
  CHATS: 'aiChats',
  QUERIES: 'aiQueries',
  UNKNOWN: 'unknownQueries',
  VISITORS: 'visitors',
  FEEDBACK: 'feedback',
} as const;

// Interfaces for Firestore documents
export interface ChatDocument {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  pageContext: string;
  messages: ChatMessageEntry[];
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface ChatMessageEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  intent?: string;
  confidence?: number;
  toolsUsed?: string[];
}

export interface QueryDocument {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  query: string;
  response: string;
  model: string;
  intent: string;
  confidence: number;
  toolsUsed: string[];
  pageContext: string;
  timestamp: string;
  isUnknown: boolean;
}

export interface UnknownQueryDocument {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  query: string;
  response: string;
  pageContext: string;
  timestamp: string;
  resolved: boolean;
  adminNotes?: string;
}

export interface VisitorDocument {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  firstVisit: string;
  lastVisit: string;
  visitCount: number;
  pagesVisited: string[];
  totalQueries: number;
  isAnonymous: boolean;
}

// Save a complete chat session
export async function saveChatSession(session: ChatDocument): Promise<string> {
  const { collection, addDoc, serverTimestamp } = await import(
    'firebase/firestore'
  );
  const db = await getFirebaseDb();
  const docRef = await addDoc(collection(db, COLLECTIONS.CHATS), {
    ...session,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

// Save individual query
export async function saveQuery(query: QueryDocument): Promise<string> {
  const { collection, addDoc } = await import('firebase/firestore');
  const db = await getFirebaseDb();
  const docRef = await addDoc(collection(db, COLLECTIONS.QUERIES), query);
  return docRef.id;
}

// Save unknown query for admin review
export async function saveUnknownQuery(
  query: UnknownQueryDocument,
): Promise<string> {
  const { collection, addDoc } = await import('firebase/firestore');
  const db = await getFirebaseDb();
  const docRef = await addDoc(collection(db, COLLECTIONS.UNKNOWN), {
    ...query,
    resolved: false,
  });
  return docRef.id;
}

// Track visitor
export async function trackVisitor(visitor: VisitorDocument): Promise<void> {
  const {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    increment,
  } = await import('firebase/firestore');
  const db = await getFirebaseDb();

  const q = query(
    collection(db, COLLECTIONS.VISITORS),
    where('userId', '==', visitor.userId),
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    await addDoc(collection(db, COLLECTIONS.VISITORS), visitor);
  } else {
    const docRef = doc(db, COLLECTIONS.VISITORS, snapshot.docs[0]!.id);
    await updateDoc(docRef, {
      lastVisit: visitor.lastVisit,
      visitCount: increment(1),
      pagesVisited: visitor.pagesVisited,
      totalQueries: increment(0),
    });
  }
}

// Mark unknown query as resolved
export async function resolveUnknownQuery(
  docId: string,
  adminNotes?: string,
): Promise<void> {
  const { doc, updateDoc } = await import('firebase/firestore');
  const db = await getFirebaseDb();
  await updateDoc(doc(db, COLLECTIONS.UNKNOWN, docId), {
    resolved: true,
    adminNotes: adminNotes || '',
  });
}

// Admin: Get all chats
export async function getAllChats(
  limit_count: number = 200,
): Promise<ChatDocument[]> {
  const {
    collection,
    query,
    orderBy,
    limit: firestoreLimit,
    getDocs,
  } = await import('firebase/firestore');
  const db = await getFirebaseDb();
  const q = query(
    collection(db, COLLECTIONS.CHATS),
    orderBy('lastMessageAt', 'desc'),
    firestoreLimit(limit_count),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as ChatDocument[];
}

// Admin: Get all queries
export async function getAllQueries(
  limit_count: number = 500,
): Promise<QueryDocument[]> {
  const {
    collection,
    query,
    orderBy,
    limit: firestoreLimit,
    getDocs,
  } = await import('firebase/firestore');
  const db = await getFirebaseDb();
  const q = query(
    collection(db, COLLECTIONS.QUERIES),
    orderBy('timestamp', 'desc'),
    firestoreLimit(limit_count),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as QueryDocument[];
}

// Admin: Get unknown queries
export async function getUnknownQueries(): Promise<UnknownQueryDocument[]> {
  const { collection, query, orderBy, getDocs } = await import(
    'firebase/firestore'
  );
  const db = await getFirebaseDb();
  const q = query(
    collection(db, COLLECTIONS.UNKNOWN),
    orderBy('timestamp', 'desc'),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as UnknownQueryDocument[];
}

// Admin: Get all visitors
export async function getAllVisitors(): Promise<VisitorDocument[]> {
  const { collection, query, orderBy, getDocs } = await import(
    'firebase/firestore'
  );
  const db = await getFirebaseDb();
  const q = query(
    collection(db, COLLECTIONS.VISITORS),
    orderBy('lastVisit', 'desc'),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as VisitorDocument[];
}

// Admin: Subscribe to real-time updates for chats
export async function subscribeToChats(
  callback: (chats: ChatDocument[]) => void,
  limit_count: number = 200,
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
    collection(db, COLLECTIONS.CHATS),
    orderBy('lastMessageAt', 'desc'),
    firestoreLimit(limit_count),
  );
  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as ChatDocument[];
    callback(chats);
  });
}

// Admin: Subscribe to real-time updates for queries
export async function subscribeToQueries(
  callback: (queries: QueryDocument[]) => void,
  limit_count: number = 500,
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
    collection(db, COLLECTIONS.QUERIES),
    orderBy('timestamp', 'desc'),
    firestoreLimit(limit_count),
  );
  return onSnapshot(q, (snapshot) => {
    const queries = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as QueryDocument[];
    callback(queries);
  });
}

// Admin: Subscribe to real-time updates for unknown queries
export async function subscribeToUnknownQueries(
  callback: (queries: UnknownQueryDocument[]) => void,
) {
  const { collection, query, orderBy, onSnapshot } = await import(
    'firebase/firestore'
  );
  const db = await getFirebaseDb();
  const q = query(
    collection(db, COLLECTIONS.UNKNOWN),
    orderBy('timestamp', 'desc'),
  );
  return onSnapshot(q, (snapshot) => {
    const queries = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as UnknownQueryDocument[];
    callback(queries);
  });
}

// Admin: Subscribe to real-time updates for visitors
export async function subscribeToVisitors(
  callback: (visitors: VisitorDocument[]) => void,
) {
  const { collection, query, orderBy, onSnapshot } = await import(
    'firebase/firestore'
  );
  const db = await getFirebaseDb();
  const q = query(
    collection(db, COLLECTIONS.VISITORS),
    orderBy('lastVisit', 'desc'),
  );
  return onSnapshot(q, (snapshot) => {
    const visitors = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as VisitorDocument[];
    callback(visitors);
  });
}

// Data: Get Category Data for AI Agent (from build-time JSON cached in Firestore)
export async function getMediaData(categoryId: string): Promise<any> {
  const { doc, getDoc } = await import('firebase/firestore');
  const db = await getFirebaseDb();
  try {
    const docRef = doc(db, 'media', categoryId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      console.log(`[Firestore] Loaded media/${categoryId}:`, {
        updatedAt: data?.updatedAt,
        hasData: !!data,
      });
      return data;
    }
    console.warn(`[Firestore] No data found for media/${categoryId}`);
    return null;
  } catch (err) {
    console.error(`[Firestore] Failed to read media/${categoryId}:`, err);
    return null;
  }
}

// Admin: Get all media documents
export async function getAllMediaOverview(): Promise<Record<string, any>> {
  const { doc, getDoc } = await import('firebase/firestore');
  const db = await getFirebaseDb();
  const categories = [
    'movies',
    'books',
    'music',
    'anime',
    'games',
    'coding',
    'social',
  ];
  const results: Record<string, any> = {};

  for (const cat of categories) {
    try {
      const snap = await getDoc(doc(db, 'media', cat));
      if (snap.exists()) {
        results[cat] = snap.data();
      }
    } catch (_err) {
      console.warn(`[Firestore] Could not load ${cat}`);
    }
  }
  return results;
}

export { ADMIN_EMAIL };
