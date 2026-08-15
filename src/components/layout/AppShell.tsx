"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AccountChip } from "@/components/auth/AccountChip";
import { useAuthState } from "@/lib/firebase/useAuth";
import type { Role } from "@/types/user";

const signedOutNavigation = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/scenario", label: "Scenario" },
  { href: "/simulation", label: "Simulation" },
  { href: "/feedback", label: "Feedback" },
];

/**
 * The run flow (Scenario → Simulation → Feedback) stays visible for everyone;
 * only the role-specific destinations differ.
 */
function navigationFor(role: Role | null) {
  // Trainees never see the scenario creator: they run cases their mentor set.
  if (role === "trainee") {
    return [
      { href: "/how-it-works", label: "How It Works" },
      { href: "/cases", label: "My Cases" },
      { href: "/simulation", label: "Simulation" },
      { href: "/feedback", label: "Feedback" },
      { href: "/progress", label: "My Progress" },
    ];
  }

  if (role === "mentor") {
    return [
      { href: "/how-it-works", label: "How It Works" },
      { href: "/scenario", label: "Create" },
      { href: "/cases", label: "Cases" },
      { href: "/simulation", label: "Simulation" },
      { href: "/mentor/group", label: "My Group" },
      { href: "/mentor", label: "Dashboard" },
    ];
  }

  return signedOutNavigation;
}

/**
 * The droplet mark, cropped from the full lockup. The lockup itself is too wide
 * for the header, and its "Healthcare Simulation" strapline would be unreadable
 * at this size — that version is used on the auth pages instead.
 */
function LogoMark() {
  return (
    <Image
      src="/logo-mark.png"
      alt=""
      width={128}
      height={128}
      priority
      className="h-full w-full object-contain"
    />
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const authState = useAuthState();
  const [isScrolled, setIsScrolled] = useState(false);

  const role = authState.status === "ready" ? authState.profile.role : null;
  const navigationItems = navigationFor(role);

  useEffect(() => {
    function handleScroll() {
      setIsScrolled(window.scrollY > 8);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main className="relative min-h-screen overflow-x-hidden text-[var(--color-ink)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-sm)] focus:border focus:border-[var(--color-primary)] focus:bg-[var(--color-surface)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--color-primary)]"
      >
        Skip to main content
      </a>

      <header
        className={`glass sticky top-0 z-40 border-b transition-all duration-[350ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] ${
          isScrolled
            ? "border-[var(--color-border)] shadow-[var(--shadow-soft)]"
            : "border-transparent"
        }`}
      >
        {/* Wraps to a second row on narrow screens so no nav item is ever clipped. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="group inline-flex items-center gap-2 text-[var(--color-ink)] transition-colors hover:text-[var(--color-primary)]"
          >
            {/* No tinted tile behind it any more: the mark carries its own
                colour, and a teal square under a green droplet read as two
                different brands stacked. */}
            {/* 44px, not 32: the mark has two figures, a heart and a cross
                inside the droplet, and below about 40px that detail turns to
                mush. --header-height in globals.css tracks this. */}
            <span className="grid h-11 w-11 shrink-0 place-items-center transition-transform duration-[350ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] group-hover:scale-110 group-hover:rotate-[-6deg]">
              <LogoMark />
            </span>
            <span className="text-base font-semibold tracking-[-0.01em]">FirstDropAI</span>
          </Link>

          <nav
            aria-label="Primary navigation"
            className="order-3 flex w-full items-center gap-5 overflow-x-auto sm:order-none sm:w-auto sm:overflow-visible"
          >
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-active={isActive}
                  aria-current={isActive ? "page" : undefined}
                  className={`link-editorial shrink-0 text-[0.9375rem] font-medium ${
                    isActive ? "text-[var(--color-primary)]" : "text-[var(--color-ink-muted)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <AccountChip />
            <Link
              href={role === "trainee" ? "/cases" : "/scenario"}
              className="btn-editorial btn-editorial--accent min-h-9 px-3 py-1.5 text-xs"
            >
              {role === "trainee" ? "Start a case" : "New scenario"}
            </Link>
          </div>
        </div>
      </header>

      <div
        id="main-content"
        className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
      >
        {children}
      </div>
    </main>
  );
}
