"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  AuthCard,
  AuthError,
  AuthField,
  AuthUnconfigured,
} from "@/components/auth/AuthCard";
import { RoleChoice } from "@/components/auth/RoleChoice";
import { LoadingButton } from "@/components/common/LoadingButton";
import {
  ensureProfile,
  friendlyAuthError,
  signOutUser,
} from "@/lib/firebase/authRepository";
import { useAuthState } from "@/lib/firebase/useAuth";
import type { Role } from "@/types/user";

/**
 * Recovery route for the gap between `createUserWithEmailAndPassword` landing
 * and the `users/{uid}` write landing — a dropped connection mid-signup leaves
 * an auth user with no profile, and this is where they finish it.
 */
export default function OnboardingPage() {
  const state = useAuthState();
  const router = useRouter();
  // Null means "not edited yet", so the field can fall back to whatever name
  // the auth account already carries without an effect writing state.
  const [typedName, setTypedName] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("trainee");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const status = state.status;

  useEffect(() => {
    if (status === "anonymous") {
      router.replace("/login");
    } else if (status === "ready") {
      router.replace("/");
    }
  }, [router, status]);

  if (state.status === "unconfigured") {
    return <AuthUnconfigured />;
  }

  if (state.status !== "needsProfile") {
    return (
      <AuthCard eyebrow="One moment" title="Loading your account...">
        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
          <div className="shimmer-text h-full w-full bg-[var(--color-primary)]" />
        </div>
      </AuthCard>
    );
  }

  const user = state.user;
  const displayName = typedName ?? user.displayName ?? "";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await ensureProfile(user, { displayName: displayName.trim(), role });
      router.replace(role === "mentor" ? "/mentor/group" : "/join");
    } catch (err) {
      setError(friendlyAuthError(err));
      setLoading(false);
    }
  }

  return (
    <AuthCard
      eyebrow="Finish setup"
      title="Your account needs a profile."
      intro={`Signed in as ${user.email ?? "your account"}. This step did not complete last time — it only takes a moment.`}
      footer={
        <button
          type="button"
          onClick={() => void signOutUser()}
          className="link-editorial font-medium text-[var(--color-primary)]"
        >
          Sign out instead
        </button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="onboarding-name"
          label="Full name"
          autoComplete="name"
          required
          value={displayName}
          onChange={(event) => setTypedName(event.target.value)}
        />

        <RoleChoice value={role} onChange={setRole} disabled={loading} />

        {error ? <AuthError message={error} /> : null}

        <LoadingButton
          type="submit"
          loading={loading}
          disabled={!displayName.trim()}
          className="w-full justify-center"
        >
          Finish setup
        </LoadingButton>
      </form>
    </AuthCard>
  );
}
