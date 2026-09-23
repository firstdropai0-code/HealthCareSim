"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AccountChip } from "@/components/auth/AccountChip";
import { GroupSwitcher } from "@/components/groups/GroupSwitcher";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { useT, type StringKey } from "@/lib/i18n/strings";
import { useAuthState } from "@/lib/firebase/useAuth";
import type { Role } from "@/types/user";

type NavItem = { href: string; key: StringKey };

const signedOutNavigation: NavItem[] = [
  { href: "/how-it-works", key: "nav.howItWorks" },
  { href: "/scenario", key: "nav.scenario" },
  { href: "/simulation", key: "nav.simulation" },
  { href: "/feedback", key: "nav.feedback" },
];

/**
 * The run flow (Scenario → Simulation → Feedback) stays visible for everyone;
 * only the role-specific destinations differ.
 */
function navigationFor(role: Role | null, hasGroup: boolean): NavItem[] {
  // Trainees never see the scenario creator: they run cases their mentor set.
  if (role === "trainee") {
    return [
      { href: "/how-it-works", key: "nav.howItWorks" },
      { href: "/cases", key: "nav.myCases" },
      { href: "/simulation", key: "nav.simulation" },
      { href: "/feedback", key: "nav.feedback" },
      /*
       * A trainee's group screen, and the only signposted way into it.
       *
       * Signup redirects to /join, but login lands on the home page, so a
       * returning trainee without a group had nothing to follow — the sole
       * route was a link buried in the "My Cases" empty state. Leaving a group
       * is now something they can do deliberately, which makes the no-group
       * state ordinary rather than a first-run blip, so the label names the
       * thing they need to do.
       */
      { href: "/join", key: hasGroup ? "nav.myGroup" : "nav.joinAGroup" },
      { href: "/progress", key: "nav.myProgress" },
    ];
  }

  if (role === "mentor") {
    return [
      { href: "/how-it-works", key: "nav.howItWorks" },
      { href: "/scenario", key: "nav.create" },
      { href: "/cases", key: "nav.cases" },
      { href: "/simulation", key: "nav.simulation" },
      { href: "/mentor/group", key: "nav.groups" },
      { href: "/mentor", key: "nav.dashboard" },
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

  const profile = authState.status === "ready" ? authState.profile : null;
  const role = profile?.role ?? null;
  const navigationItems = navigationFor(role, Boolean(profile?.groupId));
  const t = useT();

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
        {t("common.skipToContent")}
      </a>

      <header
        className={`glass sticky top-0 z-40 border-b transition-all duration-[350ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] ${
          isScrolled
            ? "border-[var(--color-border)] shadow-[var(--shadow-soft)]"
            : "border-transparent"
        }`}
      >
        {/* Wraps to a second row on narrow screens so no nav item is ever clipped. */}
        {/* Wraps to a second row on narrow screens so no nav item is ever clipped,
              but never on desktop: `lg:flex-nowrap` plus a shrinkable nav means
              a long group name or an extra nav item costs the nav a few pixels
              of scroll rather than dropping the account cluster onto its own
              line. English used to overflow this 1088px track by six pixels
              while Hindi, whose labels are shorter, did not. */}
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6 lg:flex-nowrap lg:px-8">
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
            aria-label={t("common.primaryNav")}
            /*
              `py-1` exists to contain `.link-editorial::after`, the hover
              underline, which is absolutely positioned at `bottom: -3px` and so
              sits outside the link box. That never mattered while this nav was
              `overflow: visible`; making it scrollable so it could shrink turned
              those 3px into real overflow, and a browser that has `auto` on one
              axis computes `auto` on the other -- which drew a vertical
              scrollbar, arrow buttons and all. The padding puts the underline
              back inside; `overflow-y-hidden` keeps the bar away for good.
            */
            className="order-3 flex w-full items-center gap-5 overflow-x-auto overflow-y-hidden py-1 sm:order-none sm:w-auto sm:overflow-visible lg:min-w-0 lg:overflow-x-auto lg:overflow-y-hidden"
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
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>

          {/* No call-to-action button here. It pointed at the same route as the
              nav link beside it — /scenario for mentors, already "Create";
              /cases for trainees, already "My Cases" — so it spent about 120px
              of a 1088px row on a second door to the same place, which is what
              pushed this cluster onto its own line once the group switcher
              arrived. The home page carries its own CTA for signed-out
              visitors. */}
          <div className="flex shrink-0 items-center gap-3">
            {/* Renders nothing until the mentor has a group, and nothing at all
                for trainees, who belong to exactly one. */}
            <GroupSwitcher />
            <LanguageToggle />
            <AccountChip />
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
