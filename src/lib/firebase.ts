// Firebase configuration and initialization
import { initializeApp, getApps, deleteApp, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';

const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
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
