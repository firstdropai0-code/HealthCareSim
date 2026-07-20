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
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
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
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[var(--color-surface)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--color-primary-strong)] focus:shadow-[var(--shadow-card)]"
      >
        Skip to main content
      </a>

      <div
        aria-hidden
        className="decor-capsule animate-float pointer-events-none absolute -left-14 top-[16%] hidden h-9 w-32 -rotate-[18deg] opacity-90 sm:block"
      />
      <div
        aria-hidden
        className="decor-capsule animate-float-slow pointer-events-none absolute -right-16 top-[46%] hidden h-12 w-40 rotate-[32deg] opacity-80 lg:block"
      />
      <div
        aria-hidden
        className="decor-capsule-ring animate-spin-slow pointer-events-none absolute -left-10 bottom-[8%] hidden h-36 w-36 lg:block"
      />

      <header
        className={`sticky top-0 z-40 border-b border-[var(--color-border)] bg-[rgba(251,250,247,0.86)] backdrop-blur-xl transition-shadow duration-300 ${
          isScrolled ? "header-elevated" : "shadow-[0_1px_0_rgba(255,255,255,0.7)]"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="group inline-flex min-h-11 items-center gap-2.5 text-[var(--color-ink)] transition hover:text-[var(--color-primary-strong)]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-strong)] text-white shadow-[var(--shadow-lift)] transition duration-300 group-hover:scale-105 group-hover:shadow-[0_18px_34px_rgba(15,118,110,0.32)]">
              <LogoMark />
            </span>
            <span className="text-base font-bold tracking-tight">FirstDropAI</span>
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-1 text-sm font-semibold text-[var(--color-ink-muted)] md:flex"
          >
            {navigationItems.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  className={`group relative px-4 py-2 transition-colors duration-300 ${
                    isActive ? "text-[var(--color-primary-ink)]" : "hover:text-[var(--color-primary-strong)]"
                  }`}
                  href={item.href}
                >
                  {item.label}
                  <span
                    aria-hidden
                    className={`pointer-events-none absolute inset-x-3 -bottom-0.5 h-0.5 origin-center rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-strong)] transition-transform duration-300 ease-out ${
                      isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <nav
              aria-label="Primary navigation (compact)"
              className="flex min-h-11 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-1 text-xs font-semibold text-[var(--color-ink-muted)] shadow-[var(--shadow-card)] md:hidden"
            >
              {navigationItems.map((item) => {
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    className={`nav-link rounded-full px-2.5 py-2 ${
                      isActive
                        ? "bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-strong)] text-white shadow-[var(--shadow-lift)]"
                        : "hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-ink)]"
                    }`}
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <Link
              href="/scenario"
              className="btn-shine hidden min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-strong)] px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-lift)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,118,110,0.3)] sm:inline-flex"
            >
              New scenario
            </Link>
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div id="main-content" className="page-frame p-4 sm:p-6 lg:p-9">
          {children}
        </div>
      </div>
    </main>
  );
}
