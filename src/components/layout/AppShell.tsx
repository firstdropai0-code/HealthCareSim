"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const navigationItems = [
  { href: "/how-it-works", label: "How It Works" },
  { href: "/scenario", label: "Scenario" },
  { href: "/simulation", label: "Simulation" },
  { href: "/feedback", label: "Feedback" },
];

function LogoMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M11 2h2v7h7v2h-7v7h-2V11H4V9h7V2Z" />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

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
            <span className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] bg-gradient-to-br from-[#14867d] to-[var(--color-primary)] text-white shadow-[var(--shadow-accent)] transition-transform duration-[350ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] group-hover:scale-110 group-hover:rotate-[-6deg]">
              <LogoMark />
            </span>
            <span className="text-[0.9375rem] font-semibold tracking-[-0.01em]">FirstDropAI</span>
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
                  className={`link-editorial shrink-0 text-[0.8125rem] font-medium ${
                    isActive ? "text-[var(--color-primary)]" : "text-[var(--color-ink-muted)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <Link
            href="/scenario"
            className="btn-editorial btn-editorial--accent min-h-9 px-3 py-1.5 text-xs"
          >
            New scenario
          </Link>
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
