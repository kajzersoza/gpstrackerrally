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
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth, initAuth } from '../lib/firebase';
import { ActivitySession, SharedCloudTrack } from '../types';

const COLLECTION_NAME = 'shared_tracks';

// Helper to generate a clean, readable 6-character Rally code e.g. RLY-482
export const generateShareCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let numPart = '';
  for (let i = 0; i < 4; i++) {
    numPart += chars.charAt(Math.floor(Math.random() * chars.length));
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
  const currentUser = await initAuth();
  const uid = currentUser ? currentUser.uid : 'anon-' + Math.random().toString(36).substring(2, 9);
  const shareCode = generateShareCode();
  
  // Use shareCode as document ID for direct lookup
  const docRef = doc(db, COLLECTION_NAME, shareCode);

  const sharedData: Omit<SharedCloudTrack, 'id'> = {
    shareCode,
    title: session.title || `Rally Szakasz (${session.formattedDate})`,
    ownerUid: uid,
    ownerName: ownerName || 'Adminisztrátor',
    allowPublicEdit,
    sessionData: session,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(docRef, {
    ...sharedData,
    _serverTimestamp: serverTimestamp(),
  });

  return {
    id: docRef.id,
    ...sharedData,
  };
};

/**
 * Load a shared track from Firestore by its 6-character shareCode or doc ID
 */
export const loadTrackByCode = async (
  inputCode: string
): Promise<SharedCloudTrack | null> => {
  await initAuth();
  const cleanCode = inputCode.trim().toUpperCase();

  // Try direct document fetch first
  const directRef = doc(db, COLLECTION_NAME, cleanCode);
  const directSnap = await getDoc(directRef);

  if (directSnap.exists()) {
    const data = directSnap.data();
    return {
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
  }

  // Fallback: Query by shareCode field
  const q = query(collection(db, COLLECTION_NAME), where('shareCode', '==', cleanCode));
  const querySnap = await getDocs(q);

  if (!querySnap.empty) {
    const docSnap = querySnap.docs[0];
    const data = docSnap.data();
    return {
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
  await initAuth();
  const docRef = doc(db, COLLECTION_NAME, trackId);
  await updateDoc(docRef, {
    sessionData: updatedSession,
    title: updatedSession.title,
    updatedAt: new Date().toISOString(),
  });
};

/**
 * Update permission settings on a track (Admin feature)
 */
export const updateTrackPermissions = async (
  trackId: string,
  allowPublicEdit: boolean
): Promise<void> => {
  await initAuth();
  const docRef = doc(db, COLLECTION_NAME, trackId);
  await updateDoc(docRef, {
    allowPublicEdit,
    updatedAt: new Date().toISOString(),
  });
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
      if (onError) onError(error);
    }
  );
};
