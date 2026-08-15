"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import type { AuthGateResult } from "@/lib/firebase/useAuth";
import { roleLabel } from "@/types/user";

/**
 * The blocked half of a protected page. Pages pair it with `useRequireAuth`:
 *
 *   const gate = useRequireAuth("mentor");
 *   if (gate.blocked) return <AuthGate gate={gate} />;
 */
export function AuthGate({ gate }: { gate: Extract<AuthGateResult, { blocked: true }> }) {
  if (gate.reason === "loading" || gate.reason === "redirecting") {
    return (
      <AppShell>
        <div className="mx-auto max-w-md py-16 text-center" role="status" aria-live="polite">
          <div className="mx-auto h-1 w-24 overflow-hidden rounded-full bg-[var(--color-border)]">
            <div className="shimmer-text h-full w-full bg-[var(--color-primary)]" />
          </div>
          <p className="mt-4 text-sm text-[var(--color-ink-soft)]">
            {gate.reason === "loading" ? "Checking your account..." : "Taking you to sign in..."}
          </p>
        </div>
      </AppShell>
    );
  }

  if (gate.reason === "wrongRole") {
    return (
      <AppShell>
        <div className="mx-auto max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-soft)]">
          <p className="eyebrow text-[var(--color-ink-soft)]">Not available</p>
          <h1 className="display-sm mt-3">This page is for {roleLabel[gate.requiredRole ?? "mentor"].toLowerCase()}s.</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-ink-soft)]">
            You are signed in as a {gate.actualRole ? roleLabel[gate.actualRole].toLowerCase() : "different role"}.
            Roles are fixed when the account is created.
          </p>
          <Link href="/" className="btn-editorial btn-editorial--quiet mt-5 inline-flex">
            Back to home
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-warning)] bg-[var(--color-warning-soft)] p-6 text-center">
        <p className="eyebrow text-[var(--color-ink-soft)]">Backend not connected</p>
        <h1 className="display-sm mt-3">Accounts are not set up yet.</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-ink-soft)]">
          This page needs Firebase. Add the <code>NEXT_PUBLIC_FIREBASE_*</code> values to{" "}
          <code>.env.local</code> and restart the dev server. Scenarios, simulations, and feedback
          keep working without it.
        </p>
        <Link href="/scenario" className="btn-editorial btn-editorial--quiet mt-5 inline-flex">
          Go to the scenario creator
        </Link>
      </div>
    </AppShell>
  );
}
