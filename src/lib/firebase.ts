import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId || '(default)'
);

export const auth = getAuth(app);

let authInitPromise: Promise<User | null> | null = null;

// Ensure anonymous authentication is initialized (non-blocking fallback)
export const initAuth = (): Promise<User | null> => {
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }
  if (authInitPromise) {
    return authInitPromise;
  }

  authInitPromise = new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(auth.currentUser);
    }, 2000);

    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        clearTimeout(timeout);
        unsubscribe();
        if (user) {
          resolve(user);
        } else {
          try {
            const cred = await signInAnonymously(auth);
            resolve(cred.user);
          } catch (error) {
            console.warn('Firebase anonymous auth optional, proceeding:', error);
            resolve(null);
          }
        }
      },
      (error) => {
        clearTimeout(timeout);
        console.warn('Firebase auth state error:', error);
        resolve(null);
      }
    );
  });

  return authInitPromise;
};
