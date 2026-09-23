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
import { useT } from "@/lib/i18n/strings";

export default function LoginPage() {
  const state = useAuthState();
  const router = useRouter();
  const t = useT();
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
      eyebrow={t("login.eyebrow")}
      title={t("login.title")}
      intro={t("login.intro")}
      footer={
        <>
          {t("login.noAccount")}{" "}
          <Link href="/signup" className="link-editorial font-medium text-[var(--color-primary)]">
            {t("login.createOne")}
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          id="login-email"
          label={t("auth.email")}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <AuthField
          id="login-password"
          label={t("auth.password")}
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
          {t("login.submit")}
        </LoadingButton>
      </form>
    </AuthCard>
  );
}
