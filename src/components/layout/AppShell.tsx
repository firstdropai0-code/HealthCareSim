import Link from "next/link";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen">
      <header className="border-b border-emerald-900/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-emerald-950">
            FirstDropAI
          </Link>
          <nav className="flex items-center gap-3 text-sm font-medium text-slate-600">
            <Link className="hover:text-emerald-800" href="/scenario">
              Scenario
            </Link>
            <Link className="hover:text-emerald-800" href="/simulation">
              Simulation
            </Link>
            <Link className="hover:text-emerald-800" href="/feedback">
              Feedback
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-8">{children}</div>
    </main>
  );
}
