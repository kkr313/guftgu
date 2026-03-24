// Firebase configuration and initialization
import { initializeApp, getApps, deleteApp, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDHPhw5HegUFJhFWlBp_km2-IJ-o1Xucy0',
  authDomain: 'guftgu-511b5.firebaseapp.com',
  databaseURL: 'https://guftgu-511b5-default-rtdb.firebaseio.com',
  projectId: 'guftgu-511b5',
  storageBucket: 'guftgu-511b5.firebasestorage.app',
  messagingSenderId: '1055502505262',
  appId: '1:1055502505262:web:91b9a0aafdeaf7787c96bf',
  measurementId: 'G-3P31R9LSM9',
};

let fbApp: FirebaseApp | null = null;
let fbDb: Database | null = null;

export async function initFirebase(): Promise<{ app: FirebaseApp; db: Database }> {
  if (fbApp && fbDb) return { app: fbApp, db: fbDb };

  // Clean up any existing app
  const apps = getApps();
  if (apps.length > 0) {
    for (const a of apps) {
      try { await deleteApp(a); } catch (_) { /* ignore */ }
    }
  }

  fbApp = initializeApp(FIREBASE_CONFIG);
  fbDb = getDatabase(fbApp);

  return { app: fbApp, db: fbDb };
}

export function getDb(): Database | null {
  return fbDb;
}

export function getFbApp(): FirebaseApp | null {
  return fbApp;
}

export { FIREBASE_CONFIG };
