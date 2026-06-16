import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported, logEvent, Analytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCTz_uaqfVLf5kgVm26_S-tkg3J_Iafy3Y",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "cognitive-bridge-ai.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "cognitive-bridge-ai",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "cognitive-bridge-ai.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "140307808298",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:140307808298:web:c8adcea8d451676d028353",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
// Set custom parameters (e.g. prompt: 'select_account' to allow changing account)
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Cloud Firestore
const dbId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || "ai-studio-10d489d8-3b32-488a-9698-e415f2608028";
const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

// Initialize Cloud Storage
const storage = getStorage(app);

// Initialize Firebase Analytics Safely
let analytics: Analytics | null = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch((err) => {
  console.warn("Analytics initialization failed or is not supported:", err);
});

// Helper to log analytics events safely
const logAnalyticsEvent = (eventName: string, eventParams?: Record<string, any>) => {
  try {
    if (analytics) {
      logEvent(analytics, eventName, eventParams);
    }
  } catch (err) {
    console.warn("Failed to log analytics event:", err);
  }
};

export { app, auth, googleProvider, db, storage, logAnalyticsEvent };
