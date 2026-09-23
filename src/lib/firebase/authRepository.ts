import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getDb, getFirebaseAuth } from "./firebaseApp";
import { translate, type StringKey } from "@/lib/i18n/strings";
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

export async function signUp(input: SignUpInput): Promise<User> {
  const auth = getFirebaseAuth();
  const credential = await createUserWithEmailAndPassword(auth, input.email, input.password);

  await updateProfile(credential.user, { displayName: input.displayName });
  await ensureProfile(credential.user, { displayName: input.displayName, role: input.role });

  return credential.user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  return credential.user;
}

export async function signOutUser(): Promise<void> {
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
