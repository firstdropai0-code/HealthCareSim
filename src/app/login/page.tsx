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
import { LoadingButton } from "@/components/common/LoadingButton";
import { friendlyAuthError, signIn } from "@/lib/firebase/authRepository";
import { useAuthState } from "@/lib/firebase/useAuth";

export default function LoginPage() {
  const state = useAuthState();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      await signIn(email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(friendlyAuthError(err));
      setLoading(false);
    }
  }

  return (
    <AuthCard
      eyebrow="Sign in"
      title="Welcome back."
      intro="Trainees pick up where they left off. Mentors go straight to their group."
      footer={
        <>
          No account yet?{" "}
          <Link href="/signup" className="link-editorial font-medium text-[var(--color-primary)]">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <AuthField
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error ? <AuthError message={error} /> : null}

        <LoadingButton
          type="submit"
          loading={loading}
          disabled={!email.trim() || !password}
          className="w-full justify-center"
        >
          Sign in
        </LoadingButton>
      </form>
    </AuthCard>
  );
}
