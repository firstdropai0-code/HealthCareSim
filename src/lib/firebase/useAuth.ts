"use client";

import type { User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthState, type AuthState } from "./AuthProvider";
import type { Role, UserProfile } from "@/types/user";

export { useAuthState };

/** Convenience read for components that only want the signed-in user, if any. */
export function useAuth(): { user: User | null; profile: UserProfile | null; state: AuthState } {
  const state = useAuthState();

  return {
    user: state.status === "ready" || state.status === "needsProfile" ? state.user : null,
    profile: state.status === "ready" ? state.profile : null,
    state,
  };
}

export type AuthGateResult =
  | { blocked: false; user: User | null; profile: UserProfile | null }
  | { blocked: true; reason: BlockedReason; requiredRole?: Role; actualRole?: Role };

export type BlockedReason = "loading" | "redirecting" | "wrongRole" | "unconfigured";

/**
 * Client-side gate. This is a convenience redirect, not a security boundary —
 * Firebase client auth has no server-readable session cookie without the Admin
 * SDK, so middleware cannot help here. Everything that actually matters is
 * enforced in `firestore.rules`.
 *
 * When Firebase is unconfigured this lets the page through: the localStorage-only
 * demo keeps working on a fresh clone. Pages that genuinely cannot function
 * without a backend should use `useRequireBackend` instead.
 */
export function useRequireAuth(role?: Role): AuthGateResult {
  return useGate(role, false);
}

/** Same as `useRequireAuth`, but a missing Firebase config also blocks. */
export function useRequireBackend(role?: Role): AuthGateResult {
  return useGate(role, true);
}

function useGate(role: Role | undefined, backendRequired: boolean): AuthGateResult {
  const state = useAuthState();
  const router = useRouter();

  const shouldRedirectToLogin = state.status === "anonymous";
  const shouldRedirectToOnboarding = state.status === "needsProfile";

  useEffect(() => {
    if (shouldRedirectToLogin) {
      router.replace("/login");
    } else if (shouldRedirectToOnboarding) {
      router.replace("/onboarding");
    }
  }, [router, shouldRedirectToLogin, shouldRedirectToOnboarding]);

  if (state.status === "unconfigured") {
    return backendRequired
      ? { blocked: true, reason: "unconfigured" }
      : { blocked: false, user: null, profile: null };
  }

  if (state.status === "loading") {
    return { blocked: true, reason: "loading" };
  }

  if (state.status === "anonymous" || state.status === "needsProfile") {
    return { blocked: true, reason: "redirecting" };
  }

  if (role && state.profile.role !== role) {
    return {
      blocked: true,
      reason: "wrongRole",
      requiredRole: role,
      actualRole: state.profile.role,
    };
  }

  return { blocked: false, user: state.user, profile: state.profile };
}
