"use client";

import Image from "next/image";
import Link from "next/link";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";

/**
 * The auth pages have room for the full lockup, strapline and all, so they use
 * it rather than the header's cropped mark.
 */
function LogoLockup() {
  return (
    <Image
      src="/logo-full.png"
      alt="First Drop AI — Healthcare Simulation"
      width={1376}
      height={1010}
      priority
      className="h-auto w-[13rem]"
    />
  );
}

/**
 * Auth pages deliberately do not render `AppShell` — its nav points at routes a
 * signed-out visitor cannot use.
 */
export function AuthCard({
  eyebrow,
  title,
  intro,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12 text-[var(--color-ink)]">
      <Reveal className="w-full max-w-md">
        <Link
          href="/"
          aria-label="First Drop AI home"
          className="mx-auto block w-fit transition-opacity hover:opacity-80"
        >
          <LogoLockup />
        </Link>

        <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)] sm:p-7">
          <p className="eyebrow text-[var(--color-primary)]">{eyebrow}</p>
          <h1 className="display-md mt-2">{title}</h1>
          {intro ? (
            <p className="mt-3 text-sm leading-6 text-[var(--color-ink-soft)]">{intro}</p>
          ) : null}

          <div className="mt-6">{children}</div>
        </div>

        {footer ? (
          <p className="mt-5 text-center text-sm text-[var(--color-ink-soft)]">{footer}</p>
        ) : null}
      </Reveal>
    </main>
  );
}

export function AuthField({
  label,
  hint,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow text-[var(--color-ink)]">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className="mt-2 w-full border border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] px-3 py-2.5 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)] focus:bg-white"
      />
      {hint ? <p className="mt-1.5 text-xs text-[var(--color-ink-soft)]">{hint}</p> : null}
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]"
    >
      {message}
    </div>
  );
}

/** Blocks the auth pages when the project has no Firebase credentials. */
export function AuthUnconfigured() {
  return (
    <AuthCard
      eyebrow="Backend not connected"
      title="Accounts are not set up yet."
      intro="Add the NEXT_PUBLIC_FIREBASE_* values to .env.local and restart the dev server. Scenarios, simulations, and feedback keep working without them."
    >
      <Link href="/scenario" className="btn-editorial btn-editorial--quiet w-full justify-center">
        Go to the scenario creator
      </Link>
    </AuthCard>
  );
}
