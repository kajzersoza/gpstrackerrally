import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth, initAuth } from '../lib/firebase';
import { ActivitySession, SharedCloudTrack } from '../types';

const COLLECTION_NAME = 'shared_tracks';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Clean and sanitize session to ensure 100% valid Firestore JSON without undefined fields
export function sanitizeSessionForFirestore(session: ActivitySession): ActivitySession {
  if (!session) {
    throw new Error('Érvénytelen nyomvonal adat.');
  }

  const rawCoords = Array.isArray(session.coordinates) ? session.coordinates : [];
  
  // If coordinates list is massive (>4000 points), safely downsample to fit well within Firestore 1MB limit
  let sampledCoords = rawCoords;
  if (rawCoords.length > 4000) {
    const step = Math.ceil(rawCoords.length / 4000);
    sampledCoords = rawCoords.filter((_, idx) => idx % step === 0 || idx === rawCoords.length - 1);
  }

  const cleanCoords = sampledCoords.map((c) => ({
    lat: Number(c.lat) || 0,
    lng: Number(c.lng) || 0,
    altitude: c.altitude != null ? Number(c.altitude) : null,
    speed: c.speed != null ? Number(c.speed) : null,
    accuracy: c.accuracy != null ? Number(c.accuracy) : null,
    timestamp: Number(c.timestamp) || Date.now(),
  }));

  const cleanSplits = (Array.isArray(session.splits) ? session.splits : []).map((s, idx) => ({
    id: String(s.id || `split-${idx}`),
    splitIndex: Number(s.splitIndex) || (idx + 1),
    formattedIndex: String(s.formattedIndex || String(idx + 1).padStart(2, '0')),
    name: String(s.name || `Résztáv ${idx + 1}`),
    notes: String(s.notes || ''),
    photos: Array.isArray(s.photos) ? s.photos.filter((p) => typeof p === 'string') : [],
    distanceKm: Number(s.distanceKm) || 0,
    formattedDistance: String(s.formattedDistance || `${(Number(s.distanceKm) || 0).toFixed(2)} km`),
    timeSec: Number(s.timeSec) || 0,
    formattedTime: String(s.formattedTime || '00:00'),
    paceSecPerKm: Number(s.paceSecPerKm) || 0,
    paceDiffSec: s.paceDiffSec != null ? Number(s.paceDiffSec) : 0,
    formattedDiff: String(s.formattedDiff || '+0:00'),
    trend: (s.trend === 'up' || s.trend === 'down' ? s.trend : 'same') as 'up' | 'down' | 'same',
    totalDistanceKm: Number(s.totalDistanceKm) || 0,
    totalTimeSec: Number(s.totalTimeSec) || 0,
    timestamp: Number(s.timestamp) || Date.now(),
    coordinate: s.coordinate ? {
      lat: Number(s.coordinate.lat) || 0,
      lng: Number(s.coordinate.lng) || 0,
      altitude: s.coordinate.altitude != null ? Number(s.coordinate.altitude) : null,
      speed: s.coordinate.speed != null ? Number(s.coordinate.speed) : null,
      accuracy: s.coordinate.accuracy != null ? Number(s.coordinate.accuracy) : null,
      timestamp: Number(s.coordinate.timestamp) || Date.now(),
    } : {
      lat: 0,
      lng: 0,
      timestamp: Date.now(),
    },
  }));

  return {
    id: String(session.id || `session-${Date.now()}`),
    title: String(session.title || 'Rally Track'),
    startTime: Number(session.startTime) || Date.now(),
    endTime: Number(session.endTime) || Date.now(),
    formattedStartTime: String(session.formattedStartTime || '12:00'),
    formattedDate: String(session.formattedDate || new Date().toISOString().split('T')[0]),
    totalDistanceKm: Number(session.totalDistanceKm) || 0,
    totalDurationSec: Number(session.totalDurationSec) || 0,
    avgPaceSecPerKm: Number(session.avgPaceSecPerKm) || 0,
    maxSpeedKmh: Number(session.maxSpeedKmh) || 0,
    avgSpeedKmh: Number(session.avgSpeedKmh) || 0,
    splits: cleanSplits,
    coordinates: cleanCoords,
    notes: String(session.notes || ''),
  };
}

// Helper to generate a clean, readable and unique 5-6 character Rally code e.g. RLY-842A
export const generateShareCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let numPart = '';
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint8Array(4);
    window.crypto.getRandomValues(array);
    for (let i = 0; i < 4; i++) {
      numPart += chars.charAt(array[i] % chars.length);
    }
  } else {
    for (let i = 0; i < 4; i++) {
      numPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return `RLY-${numPart}`;
};

/**
 * Upload an ActivitySession to Firestore Cloud with permissions
 */
export const uploadTrackToCloud = async (
  session: ActivitySession,
  allowPublicEdit: boolean,
  ownerName: string
): Promise<SharedCloudTrack> => {
  const currentUser = await initAuth().catch(() => null);
  const uid = currentUser ? currentUser.uid : 'anon-' + Math.random().toString(36).substring(2, 9);
  const shareCode = generateShareCode();
  
  // Use shareCode as document ID for direct lookup
  const docRef = doc(db, COLLECTION_NAME, shareCode);

  // Clean session to remove any undefined fields before sending to Firestore
  const cleanSession = sanitizeSessionForFirestore(session);

  const sharedData: Omit<SharedCloudTrack, 'id'> = {
    shareCode,
    title: cleanSession.title || `Rally Szakasz (${cleanSession.formattedDate})`,
    ownerUid: uid,
    ownerName: ownerName || 'Adminisztrátor',
    allowPublicEdit: allowPublicEdit !== false,
    sessionData: cleanSession,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const result: SharedCloudTrack = {
    id: docRef.id,
    ...sharedData,
  };

  try {
    await setDoc(docRef, sharedData);
  } catch (firestoreError: any) {
    console.warn('Firestore write failed, caching locally as fallback:', firestoreError);
    // Store in localStorage as backup
    try {
      localStorage.setItem(`cloud_track_${shareCode}`, JSON.stringify(result));
    } catch {}
    handleFirestoreError(firestoreError, OperationType.CREATE, `${COLLECTION_NAME}/${shareCode}`);
  }

  // Cache locally as backup
  try {
    localStorage.setItem(`cloud_track_${shareCode}`, JSON.stringify(result));
  } catch (e) {
    // Ignore storage quota limits
  }

  return result;
};

/**
 * Load a shared track from Firestore by its 6-character shareCode or doc ID
 */
export const loadTrackByCode = async (
  inputCode: string
): Promise<SharedCloudTrack | null> => {
  await initAuth().catch(() => null);
  const cleanCode = inputCode.trim().toUpperCase();

  if (!cleanCode) return null;

  // 1. Try local cache first for instant response
  try {
    const cached = localStorage.getItem(`cloud_track_${cleanCode}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.shareCode === cleanCode) {
        // Still verify / fetch latest from Firestore in background
        getDoc(doc(db, COLLECTION_NAME, cleanCode)).catch(() => null);
        return parsed;
      }
    }
  } catch (e) {
    // ignore
  }

  // 2. Try direct document fetch from Firestore
  try {
    const directRef = doc(db, COLLECTION_NAME, cleanCode);
    const directSnap = await getDoc(directRef);

    if (directSnap.exists()) {
      const data = directSnap.data();
      const track: SharedCloudTrack = {
        id: directSnap.id,
        shareCode: data.shareCode || directSnap.id,
        title: data.title || 'Megosztott Track',
        ownerUid: data.ownerUid || '',
        ownerName: data.ownerName || 'Admin',
        allowPublicEdit: data.allowPublicEdit !== false,
        sessionData: data.sessionData as ActivitySession,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
      try {
        localStorage.setItem(`cloud_track_${cleanCode}`, JSON.stringify(track));
      } catch {}
      return track;
    }
  } catch (err: any) {
    console.warn('Direct fetch error, trying query fallback:', err);
    if (err?.code === 'permission-denied') {
      handleFirestoreError(err, OperationType.GET, `${COLLECTION_NAME}/${cleanCode}`);
    }
  }

  // 3. Fallback: Query by shareCode field
  try {
    const q = query(collection(db, COLLECTION_NAME), where('shareCode', '==', cleanCode));
    const querySnap = await getDocs(q);

    if (!querySnap.empty) {
      const docSnap = querySnap.docs[0];
      const data = docSnap.data();
      const track: SharedCloudTrack = {
        id: docSnap.id,
        shareCode: data.shareCode || docSnap.id,
        title: data.title || 'Megosztott Track',
        ownerUid: data.ownerUid || '',
        ownerName: data.ownerName || 'Admin',
        allowPublicEdit: data.allowPublicEdit !== false,
        sessionData: data.sessionData as ActivitySession,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
      try {
        localStorage.setItem(`cloud_track_${cleanCode}`, JSON.stringify(track));
      } catch {}
      return track;
    }
  } catch (err: any) {
    console.error('Firestore query failed:', err);
    if (err?.code === 'permission-denied') {
      handleFirestoreError(err, OperationType.LIST, COLLECTION_NAME);
    }
  }

  return null;
};

/**
 * Update an existing shared track in the cloud (splits, notes, coordinates)
 */
export const updateSharedTrackInCloud = async (
  trackId: string,
  updatedSession: ActivitySession
): Promise<void> => {
  await initAuth().catch(() => null);
  const docRef = doc(db, COLLECTION_NAME, trackId);
  const cleanSession = sanitizeSessionForFirestore(updatedSession);
  try {
    await updateDoc(docRef, {
      sessionData: cleanSession,
      title: updatedSession.title,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${trackId}`);
  }
};

/**
 * Update permission settings on a track (Admin feature)
 */
export const updateTrackPermissions = async (
  trackId: string,
  allowPublicEdit: boolean
): Promise<void> => {
  await initAuth().catch(() => null);
  const docRef = doc(db, COLLECTION_NAME, trackId);
  try {
    await updateDoc(docRef, {
      allowPublicEdit,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${COLLECTION_NAME}/${trackId}`);
  }
};

/**
 * Subscribe to real-time updates for a cloud track
 */
export const subscribeToTrack = (
  trackId: string,
  onUpdate: (track: SharedCloudTrack) => void,
  onError?: (err: Error) => void
): (() => void) => {
  const docRef = doc(db, COLLECTION_NAME, trackId);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate({
          id: snapshot.id,
          shareCode: data.shareCode || snapshot.id,
          title: data.title || 'Megosztott Track',
          ownerUid: data.ownerUid || '',
          ownerName: data.ownerName || 'Admin',
          allowPublicEdit: data.allowPublicEdit !== false,
          sessionData: data.sessionData as ActivitySession,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      }
    },
    (error) => {
      console.error('Real-time sync listener error:', error);
      handleFirestoreError(error, OperationType.GET, `${COLLECTION_NAME}/${trackId}`);
      if (onError) onError(error);
    }
  );
};
