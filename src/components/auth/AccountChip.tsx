"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOutUser } from "@/lib/firebase/authRepository";
import { useAuthState } from "@/lib/firebase/useAuth";
import { initialsFor, roleLabel } from "@/types/user";

export function AccountChip() {
  const state = useAuthState();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Nothing to show when the project has no backend, and nothing useful to show
  // while the profile is still resolving.
  if (state.status === "unconfigured" || state.status === "loading") {
    return null;
  }

  if (state.status === "anonymous" || state.status === "needsProfile") {
    return (
      <Link
        href={state.status === "anonymous" ? "/login" : "/onboarding"}
        className="link-editorial shrink-0 text-[0.9375rem] font-medium text-[var(--color-ink-muted)]"
      >
        {state.status === "anonymous" ? "Sign in" : "Finish setup"}
      </Link>
    );
  }

  const { profile } = state;

  async function handleSignOut() {
    setOpen(false);
    await signOutUser();
    router.replace("/login");
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-1 pl-1 pr-3 transition-colors hover:border-[var(--color-border-strong)]"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[0.6875rem] font-semibold text-[var(--color-primary)]">
          {initialsFor(profile)}
        </span>
        <span className="max-w-[9rem] truncate text-xs font-medium text-[var(--color-ink)]">
          {profile.displayName || profile.email}
        </span>
      </button>

      {open ? (
        <>
          {/* Click-away layer, so the menu closes without a document listener. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-52 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-[var(--shadow-lift)]"
          >
            <p className="px-2 pb-2 pt-1 text-xs text-[var(--color-ink-soft)]">
              {roleLabel[profile.role]}
              {profile.groupId ? "" : " · no group yet"}
            </p>
            <button
              type="button"
              role="menuitem"
              onClick={() => void handleSignOut()}
              className="w-full rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm text-[var(--color-ink)] transition-colors hover:bg-[var(--color-canvas-soft)]"
            >
              Sign out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
