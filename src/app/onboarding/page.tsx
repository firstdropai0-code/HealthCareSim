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
import { useT } from "@/lib/i18n/strings";
import type { Role } from "@/types/user";

/**
 * Recovery route for the gap between `createUserWithEmailAndPassword` landing
 * and the `users/{uid}` write landing — a dropped connection mid-signup leaves
 * an auth user with no profile, and this is where they finish it.
 */
export default function OnboardingPage() {
  const state = useAuthState();
  const router = useRouter();
  const t = useT();
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
      <AuthCard eyebrow={t("onboarding.waitEyebrow")} title={t("onboarding.waitTitle")}>
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
      eyebrow={t("onboarding.eyebrow")}
      title={t("onboarding.title")}
      intro={t("onboarding.intro", { email: user.email ?? t("onboarding.yourAccount") })}
      footer={
        <button
          type="button"
          onClick={() => void signOutUser()}
          className="link-editorial font-medium text-[var(--color-primary)]"
        >
          {t("onboarding.signOut")}
        </button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="onboarding-name"
          label={t("auth.fullName")}
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
          {t("onboarding.submit")}
        </LoadingButton>
      </form>
    </AuthCard>
  );
}
