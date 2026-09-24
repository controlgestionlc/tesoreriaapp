import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase's web configuration identifies the public project. Environment
// variables may override it without changing the source code.
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBlshKtLtTPHarki67z8tqPvDRv5Gha49Q",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "tesoreriaapp-e8bac.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "tesoreriaapp-e8bac",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "tesoreriaapp-e8bac.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "458246153810",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:458246153810:web:b8d6ea4a3fe96bf388a18b",
};

export const firebaseReady = Object.values(config).every(Boolean);
export const firebaseApp = firebaseReady ? initializeApp(config) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const firestore = firebaseApp ? getFirestore(firebaseApp) : null;
export const googleProvider = new GoogleAuthProvider();

if (auth) void setPersistence(auth, browserLocalPersistence);
