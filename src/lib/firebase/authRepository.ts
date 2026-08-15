import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { getDb, getFirebaseAuth } from "./firebaseApp";
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

const authErrorCopy: Record<string, string> = {
  "auth/invalid-email": "That email address does not look right.",
  "auth/missing-password": "Enter your password.",
  "auth/weak-password": "Pick a password with at least 6 characters.",
  "auth/email-already-in-use": "An account already uses that email. Try signing in instead.",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/user-not-found": "Email or password is incorrect.",
  "auth/too-many-requests": "Too many attempts. Wait a minute and try again.",
  "auth/network-request-failed": "Could not reach the server. Check your connection.",
  "auth/operation-not-allowed":
    "Email and password sign-in is disabled for this Firebase project. Enable it in Authentication → Sign-in method.",
};

/** Turns a Firebase error code into copy a trainee can act on. */
export function friendlyAuthError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  return authErrorCopy[code] ?? (error instanceof Error ? error.message : "Something went wrong.");
}
