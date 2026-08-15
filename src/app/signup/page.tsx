"use client";

import Link from "next/link";
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
import { friendlyAuthError, signUp } from "@/lib/firebase/authRepository";
import { useAuthState } from "@/lib/firebase/useAuth";
import type { Role } from "@/types/user";

export default function SignUpPage() {
  const state = useAuthState();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("trainee");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignedIn = state.status === "ready";

  useEffect(() => {
    if (isSignedIn) {
      router.replace("/");
    }
  }, [isSignedIn, router]);

  if (state.status === "unconfigured") {
    return <AuthUnconfigured />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await signUp({
        email: email.trim(),
        password,
        displayName: displayName.trim(),
        role,
      });
      // Mentors need a group before anything else works; trainees need a code.
      router.replace(role === "mentor" ? "/mentor/group" : "/join");
    } catch (err) {
      setError(friendlyAuthError(err));
      setLoading(false);
    }
  }

  return (
    <AuthCard
      eyebrow="Create account"
      title="Set up your account."
      footer={
        <>
          Already have one?{" "}
          <Link href="/login" className="link-editorial font-medium text-[var(--color-primary)]">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="signup-name"
          label="Full name"
          autoComplete="name"
          required
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          hint="Your mentor sees this next to your results."
        />
        <AuthField
          id="signup-email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <AuthField
          id="signup-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          hint="At least 6 characters."
        />

        <RoleChoice value={role} onChange={setRole} disabled={loading} />

        {error ? <AuthError message={error} /> : null}

        <LoadingButton
          type="submit"
          loading={loading}
          disabled={!displayName.trim() || !email.trim() || password.length < 6}
          className="w-full justify-center"
        >
          Create account
        </LoadingButton>
      </form>
    </AuthCard>
  );
}
