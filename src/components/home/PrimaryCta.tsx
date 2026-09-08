"use client";

import Link from "next/link";
import { useAuthState } from "@/lib/firebase/useAuth";

/**
 * The home page's primary call to action, pointed at whatever the visitor can
 * actually do next.
 *
 * `/scenario` is mentor-only, so for a signed-in trainee the default label sent
 * them into a wrong-role gate — the one place on the page that promises to get
 * them started was the one place they could not go.
 *
 * The home page is a server component and Firebase auth is client-side, so this
 * has to be its own client island. It resolves from "loading" to the role-aware
 * destination on hydration, the same way the header nav already does.
 */
export function PrimaryCta({
  defaultLabel,
  className = "",
}: {
  /** Shown to signed-out visitors and mentors, whose destination is unchanged. */
  defaultLabel: string;
  className?: string;
}) {
  const state = useAuthState();
  const profile = state.status === "ready" ? state.profile : null;

  const { href, label } =
    profile?.role === "trainee"
      ? profile.groupId
        ? { href: "/cases", label: "Start a case" }
        : // Nothing else works until they redeem a code, so say that rather
          // than offering a case list that will be empty.
          { href: "/join", label: "Join a group" }
      : { href: "/scenario", label: defaultLabel };

  return (
    <Link href={href} className={`btn-editorial btn-editorial--accent ${className}`.trim()}>
      {label}
    </Link>
  );
}
