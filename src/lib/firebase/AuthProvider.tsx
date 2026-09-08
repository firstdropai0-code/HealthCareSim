"use client";

import type { User } from "firebase/auth";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getDb, getFirebaseAuth, isFirebaseConfigured } from "./firebaseApp";
import { isRole, type Role, type UserProfile } from "@/types/user";

/**
 * `unconfigured` is not an error state. A clone with no NEXT_PUBLIC_FIREBASE_*
 * variables still runs the whole scenario → simulation → feedback flow against
 * localStorage; only the account features are hidden.
 *
 * `needsProfile` covers the gap between `createUserWithEmailAndPassword`
 * succeeding and the `users/{uid}` write landing. Without it a dropped
 * connection mid-signup would leave an auth user with nowhere to go.
 */
export type AuthState =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "needsProfile"; user: User }
  | { status: "ready"; user: User; profile: UserProfile };

const AuthContext = createContext<AuthState>({ status: "loading" });

function toProfile(uid: string, data: Record<string, unknown> | undefined): UserProfile | null {
  if (!data || !isRole(data.role)) {
    return null;
  }

  return {
    uid,
    email: typeof data.email === "string" ? data.email : "",
    displayName: typeof data.displayName === "string" ? data.displayName : "",
    role: data.role as Role,
    groupId: typeof data.groupId === "string" ? data.groupId : null,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() =>
    isFirebaseConfigured() ? { status: "loading" } : { status: "unconfigured" },
  );

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      return;
    }

    let profileUnsubscribe: (() => void) | null = null;
    let cancelled = false;

    const authUnsubscribe = getFirebaseAuth().onAuthStateChanged((user) => {
      profileUnsubscribe?.();
      profileUnsubscribe = null;

      if (!user) {
        setState({ status: "anonymous" });
        return;
      }

      setState({ status: "loading" });

      // Firestore is pulled in only now, once there is a signed-in user whose
      // profile we actually need to read.
      void (async () => {
        const [db, { doc, onSnapshot }] = await Promise.all([
          getDb(),
          import("firebase/firestore"),
        ]);

        if (cancelled || getFirebaseAuth().currentUser?.uid !== user.uid) {
          return;
        }

        // Reset per subscription: it tracks whether THIS user's profile has
        // reached the UI yet.
        let deliveredProfile = false;

        profileUnsubscribe = onSnapshot(
          doc(db, "users", user.uid),
          // Needed for the pending-write check below: without it Firestore
          // sends no event when a local write is acknowledged, because only the
          // metadata changed.
          { includeMetadataChanges: true },
          (snapshot) => {
            /*
             * Ignore the optimistic local echo of our own write, but only once
             * a profile has actually been delivered.
             *
             * Why skip it at all: `groupId` is not just app state — the
             * scenarios and runs rules resolve `profile().groupId` against the
             * SERVER's copy of this document. Publishing the pending value has
             * every dependent query fire against a pointer the server has not
             * committed yet, and those reads are denied rather than merely
             * early. Switching group is exactly that case.
             *
             * Why only after the first delivery: a write that is never
             * acknowledged — offline, or a wedged connection — leaves every
             * subsequent snapshot flagged pending. Skipping unconditionally
             * would then strand the app on "Checking your account..." with no
             * way out. Resolving from whatever arrives first, and only holding
             * back later echoes, keeps the race closed without ever hanging.
             */
            if (snapshot.metadata.hasPendingWrites && deliveredProfile) {
              return;
            }

            const profile = snapshot.exists() ? toProfile(user.uid, snapshot.data()) : null;
            deliveredProfile = profile !== null;
            setState(
              profile ? { status: "ready", user, profile } : { status: "needsProfile", user },
            );
          },
          () => {
            // A read failure here is almost always the profile not existing yet
            // under rules that require it; treat it the same as missing.
            setState({ status: "needsProfile", user });
          },
        );
      })();
    });

    return () => {
      cancelled = true;
      profileUnsubscribe?.();
      authUnsubscribe();
    };
  }, []);

  const value = useMemo(() => state, [state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthState(): AuthState {
  return useContext(AuthContext);
}
