"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import type { AuthGateResult } from "@/lib/firebase/useAuth";
import { useT } from "@/lib/i18n/strings";

/**
 * The blocked half of a protected page. Pages pair it with `useRequireAuth`:
 *
 *   const gate = useRequireAuth("mentor");
 *   if (gate.blocked) return <AuthGate gate={gate} />;
 */
export function AuthGate({ gate }: { gate: Extract<AuthGateResult, { blocked: true }> }) {
  const t = useT();

  if (gate.reason === "loading" || gate.reason === "redirecting") {
    return (
      <AppShell>
        <div className="mx-auto max-w-md py-16 text-center" role="status" aria-live="polite">
          <div className="mx-auto h-1 w-24 overflow-hidden rounded-full bg-[var(--color-border)]">
            <div className="shimmer-text h-full w-full bg-[var(--color-primary)]" />
          </div>
          <p className="mt-4 text-sm text-[var(--color-ink-soft)]">
            {gate.reason === "loading" ? t("gate.checking") : t("gate.redirecting")}
          </p>
        </div>
      </AppShell>
    );
  }

  if (gate.reason === "wrongRole") {
    return (
      <AppShell>
        <div className="mx-auto max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-soft)]">
          <p className="eyebrow text-[var(--color-ink-soft)]">{t("gate.notAvailable")}</p>
          <h1 className="display-sm mt-3">
            {t("gate.wrongRoleTitle", {
              role: t(gate.requiredRole === "trainee" ? "role.traineeLower" : "role.mentorLower"),
            })}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-ink-soft)]">
            {t("gate.wrongRoleBody", {
              role: gate.actualRole
                ? t(gate.actualRole === "trainee" ? "role.traineeLower" : "role.mentorLower")
                : t("gate.differentRole"),
            })}
          </p>
          <Link href="/" className="btn-editorial btn-editorial--quiet mt-5 inline-flex">
            {t("gate.backHome")}
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-warning)] bg-[var(--color-warning-soft)] p-6 text-center">
        <p className="eyebrow text-[var(--color-ink-soft)]">{t("gate.backendTitle")}</p>
        <h1 className="display-sm mt-3">{t("gate.accountsNotSet")}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-ink-soft)]">{t("gate.backendBody")}</p>
        <Link href="/scenario" className="btn-editorial btn-editorial--quiet mt-5 inline-flex">
          {t("gate.toCreator")}
        </Link>
      </div>
    </AppShell>
  );
}
