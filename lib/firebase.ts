import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Helper function to get environment variables
// Works in both Vite client (import.meta.env) and Node.js serverless (process.env)
function getEnvVar(key: string): string {
  // Check if we're in a Node.js environment (serverless functions)
  if (typeof process !== 'undefined' && process.env) {
    // For serverless, try both with and without VITE_ prefix
    // Vercel environment variables can be set with or without VITE_ prefix
    return process.env[key] || process.env[key.replace('VITE_', '')] || '';
  }
  // For client-side (Vite), use import.meta.env
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env as any)[key] || '';
  }
  return '';
}

// Firebase configuration - fill in your Firebase project credentials
const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY'),
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID'),
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('VITE_FIREBASE_APP_ID'),
  measurementId: getEnvVar('VITE_FIREBASE_MEASUREMENT_ID') // Optional
};

// Initialize Firebase (prevent multiple initializations)
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

// Initialize Firebase services (Auth, Firestore, and Storage)
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

export default app;

