import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
// Set custom parameters (e.g. prompt: 'select_account' to allow changing account)
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Cloud Firestore
const dbId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;
const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

// Initialize Cloud Storage
const storage = getStorage(app);

export { app, auth, googleProvider, db, storage };
