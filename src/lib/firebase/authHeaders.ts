import { getFirebaseAuth, isFirebaseConfigured } from "./firebaseApp";

/**
 * The header that tells the AI routes who is calling (see `apiGuard.ts`).
 *
 * Empty when Firebase is not configured: the routes ask for nothing in that
 * mode, and the localStorage-only demo has no one to sign in as.
 *
 * `getIdToken()` answers from memory and only goes to the network when the
 * token is within minutes of expiring, so this adds nothing measurable to a
 * turn's wait for its voice.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  if (!isFirebaseConfigured()) {
    return {};
  }

  const auth = getFirebaseAuth();

  // `currentUser` is null until the persisted session has been read back, so a
  // call made in a page's first moments would otherwise go out unsigned.
  await auth.authStateReady();

  const user = auth.currentUser;

  return user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {};
}
