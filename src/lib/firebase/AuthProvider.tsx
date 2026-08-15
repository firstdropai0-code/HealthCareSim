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

        profileUnsubscribe = onSnapshot(
          doc(db, "users", user.uid),
          (snapshot) => {
            const profile = snapshot.exists() ? toProfile(user.uid, snapshot.data()) : null;
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
