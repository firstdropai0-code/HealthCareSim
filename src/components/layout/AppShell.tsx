import Link from "next/link";
import type { ReactNode } from "react";

const navigationItems = [
  { href: "/scenario", label: "Scenario" },
  { href: "/simulation", label: "Simulation" },
  { href: "/feedback", label: "Feedback" },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen text-[var(--color-ink)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-[var(--color-surface)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--color-primary-strong)] focus:shadow-[var(--shadow-card)]"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[rgba(251,250,247,0.88)] shadow-[0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="group inline-flex min-h-11 items-center gap-3 rounded-full pr-3 text-[var(--color-ink)] transition hover:text-[var(--color-primary-strong)]"
          >
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--color-primary)] text-base font-semibold text-white shadow-[var(--shadow-lift)] transition group-hover:bg-[var(--color-primary-strong)]">
              FD
            </span>
            <span className="leading-tight">
              <span className="block text-base font-semibold tracking-tight">FirstDropAI</span>
              <span className="hidden text-xs font-medium text-[var(--color-ink-soft)] sm:block">
                Healthcare communication trainer
              </span>
            </span>
          </Link>
          <nav
            aria-label="Primary navigation"
            className="flex min-h-11 items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/85 p-1 text-sm font-semibold text-[var(--color-ink-muted)] shadow-[var(--shadow-card)]"
          >
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                className="rounded-full px-3 py-2 transition hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-ink)] sm:px-4"
                href={item.href}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div id="main-content" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        {children}
      </div>
    </main>
  );
}
