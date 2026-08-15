import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

/**
 * Firebase web config.
 *
 * Unlike GEMINI_API_KEY / OPENAI_API_KEY — which are read only inside
 * `src/app/api/**` and never reach the browser — these are PUBLIC identifiers
 * that ship in the client bundle by design. They identify the project; they do
 * not authorise anything. Access control lives entirely in `firestore.rules`.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * False when the project has no Firebase credentials. The app stays usable in
 * that state — scenarios, simulations, and feedback still run against
 * localStorage, only the account and progress features are hidden.
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}

function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) {
    throw new Error(
      "Firebase is not configured. Set the NEXT_PUBLIC_FIREBASE_* variables in .env.local.",
    );
  }

  // Fast Refresh re-evaluates this module on every edit in dev, and a bare
  // initializeApp would throw `duplicate-app` on the second pass.
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

/**
 * Async on purpose. `firebase/firestore` is ~200 KB gzipped and the auth
 * provider sits in the root layout, so a static import would put it on the
 * marketing pages too. Loading it here means a signed-out visitor on `/` never
 * pays for it — the chunk arrives only once something actually reads data.
 */
export async function getDb(): Promise<Firestore> {
  const { getFirestore } = await import("firebase/firestore");
  return getFirestore(getFirebaseApp());
}
