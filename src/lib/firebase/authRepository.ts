import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getDb, getFirebaseAuth } from "./firebaseApp";
import { translate, type StringKey } from "@/lib/i18n/strings";
import {
  loadSimulationOwner,
  releaseSimulationStorage,
} from "@/lib/storage/localSimulationStorage";
import type { Role, UserProfile } from "@/types/user";

export type SignUpInput = {
  email: string;
  password: string;
  displayName: string;
  role: Role;
};

/**
 * Writes `users/{uid}`. Idempotent by design: signup calls it once, and
 * `/onboarding` calls it again if that first write never landed. Merge keeps a
 * later `groupId` from being wiped, and `role` is only ever sent on create
 * because the rules reject any update that changes it.
 */
export async function ensureProfile(
  user: User,
  input: { displayName: string; role: Role },
): Promise<void> {
  const [db, { doc, getDoc, setDoc }] = await Promise.all([
    getDb(),
    import("firebase/firestore"),
  ]);

  const ref = doc(db, "users", user.uid);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    await setDoc(
      ref,
      { displayName: input.displayName, updatedAt: new Date().toISOString() },
      { merge: true },
    );
    return;
  }

  const now = new Date().toISOString();
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email ?? "",
    displayName: input.displayName,
    role: input.role,
    groupId: null,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(ref, profile);
}

/**
 * Drops whatever run is in this browser unless it was made by `uid`.
 *
 * Stricter than the claim the auth provider makes on every session: a run with
 * no owner stamp is dropped too, because at a fresh sign-in there is no way to
 * tell whose it was. The owner is read BEFORE signing in for the same reason --
 * the provider stamps the new user the moment the session changes, which can
 * be before the sign-in call returns, and a stamp read afterwards would
 * already name them.
 */
function dropRunUnlessOwnedBy(uid: string, ownerBeforeSignIn: string | null): void {
  if (ownerBeforeSignIn !== uid) {
    releaseSimulationStorage();
  }
}

export async function signUp(input: SignUpInput): Promise<User> {
  const auth = getFirebaseAuth();
  const ownerBefore = loadSimulationOwner();
  const credential = await createUserWithEmailAndPassword(auth, input.email, input.password);
  dropRunUnlessOwnedBy(credential.user.uid, ownerBefore);

  await updateProfile(credential.user, { displayName: input.displayName });
  await ensureProfile(credential.user, { displayName: input.displayName, role: input.role });

  return credential.user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const ownerBefore = loadSimulationOwner();
  const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  // Someone whose session lapsed mid-run signs back in and finds it; anyone
  // else starts clean.
  dropRunUnlessOwnedBy(credential.user.uid, ownerBefore);
  return credential.user;
}

export async function signOutUser(): Promise<void> {
  // Before the session ends, so the run is gone even if the sign-out request
  // itself fails: on a shared computer the next person must not find it.
  releaseSimulationStorage();
  await signOut(getFirebaseAuth());
}

const authErrorCopy: Record<string, StringKey> = {
  "auth/invalid-email": "authError.invalidEmail",
  "auth/missing-password": "authError.missingPassword",
  "auth/weak-password": "authError.weakPassword",
  "auth/email-already-in-use": "authError.emailInUse",
  "auth/invalid-credential": "authError.badCredentials",
  "auth/wrong-password": "authError.badCredentials",
  "auth/user-not-found": "authError.badCredentials",
  "auth/too-many-requests": "authError.tooMany",
  "auth/network-request-failed": "authError.network",
  "auth/operation-not-allowed": "authError.disabled",
};

/** Turns a Firebase error code into copy a trainee can act on. */
export function friendlyAuthError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  const key = authErrorCopy[code];
  if (key) {
    return translate(key);
  }

  return error instanceof Error ? error.message : translate("error.generic");
}
