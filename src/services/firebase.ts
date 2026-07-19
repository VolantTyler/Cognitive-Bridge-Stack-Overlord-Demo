import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported, logEvent, Analytics } from "firebase/analytics";

export const SANDBOX_FIREBASE_PROJECT_ID = "stack-overlord-demo-cog-bridge";

const firebaseApiKey =
  import.meta.env.VITE_FIREBASE_API_KEY?.trim() ||
  (import.meta.env.MODE === "test" ? "sandbox-test-api-key" : "");

if (!firebaseApiKey) {
  throw new Error(
    "VITE_FIREBASE_API_KEY must contain the sandbox Firebase Web API key.",
  );
}

const firebaseConfig = {
  apiKey: firebaseApiKey,
  authDomain: "stack-overlord-demo-cog-bridge.firebaseapp.com",
  projectId: SANDBOX_FIREBASE_PROJECT_ID,
  storageBucket: "stack-overlord-demo-cog-bridge.firebasestorage.app",
  messagingSenderId: "1068616268253",
  appId: "1:1068616268253:web:a90ad3905289bf8b1e9e34",
  measurementId: "G-RV7TG1N62C",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
// Set custom parameters (e.g. prompt: 'select_account' to allow changing account)
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Cloud Firestore
const dbId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID?.trim();
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
