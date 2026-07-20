import Link from "next/link";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import { InfoCard } from "@/components/common/VisualCards";
import { HeroChatSnippet } from "@/components/home/HeroChatSnippet";
import { AppShell } from "@/components/layout/AppShell";

const workflowSteps = [
  ["Create", "Rough note to brief"],
  ["Practice", "Adaptive roleplay"],
  ["Review", "Scan feedback"],
];

const focusAreas = [
  {
    title: "Empathy",
    description: "Acknowledge emotion before explaining facts.",
    icon: (
      <path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 2.5 5 6 5c2 0 3.5 1.2 4 2.5.5-1.3 2-2.5 4-2.5 3.5 0 5.5 3.5 3.5 7.5C19 16.65 12 21 12 21Z" />
    ),
  },
  {
    title: "Clarity",
    description: "Explain plans in plain, jargon-free language.",
    icon: <path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5" />,
  },
  {
    title: "Listening",
    description: "Notice both spoken and unspoken concerns.",
    icon: <path d="M4 4h16v10H8l-4 4V4Z" />,
  },
  {
    title: "Pressure handling",
    description: "Stay calm and clear when tension rises.",
    icon: (
      <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" />
    ),
  },
];

const marqueeWords = ["Empathetic", "Clear", "Patient", "Curious", "Calm", "Trustworthy"];

function FocusIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      {children}
    </svg>
  );
}

function MarqueeRibbon() {
  const doubled = [...marqueeWords, ...marqueeWords, ...marqueeWords];

  return (
    <div className="relative z-10 -mt-7 overflow-hidden sm:-mt-8">
      <div className="-rotate-1 overflow-hidden bg-gradient-to-r from-[var(--color-primary)] via-[var(--color-primary-strong)] to-[var(--color-primary)] py-3 shadow-[0_18px_40px_rgba(7,59,55,0.28)] sm:py-3.5">
        <div className="marquee-track">
          {[0, 1].map((copy) => (
            <span key={copy} className="flex shrink-0 items-center">
              {doubled.map((word, index) => (
                <span
                  key={`${copy}-${word}-${index}`}
                  className="flex items-center px-4 text-sm font-semibold uppercase tracking-[0.18em] text-white sm:px-6 sm:text-base"
                >
                  {word}
                  <span aria-hidden className="ml-4 h-1.5 w-1.5 rounded-full bg-white/60 sm:ml-6" />
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}


export default function Home() {
  return (
    <AppShell>
      <section className="relative overflow-hidden rounded-[2rem] bg-white">
        <div
          aria-hidden
          className="animate-float pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-[var(--color-primary)]/12 blur-3xl"
        />
        <div
          aria-hidden
          className="animate-float-slow pointer-events-none absolute -right-16 top-10 h-64 w-64 rounded-full bg-amber-200/20 blur-3xl"
        />

        <div className="relative grid gap-10 p-6 pb-12 sm:p-10 sm:pb-16 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center lg:p-14 lg:pb-20">
          <div className="max-w-xl">
            <p className="animate-fade-up inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary-strong)] shadow-sm">
              Healthcare communication training
            </p>
            <h1 className="animate-fade-up animate-fade-up-1 mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-6xl">
              A training room <span className="text-[var(--color-primary)]">that lives</span> in your browser.
            </h1>
            <p className="animate-fade-up animate-fade-up-2 mt-4 text-base leading-7 text-[var(--color-ink-muted)] sm:text-lg">
              Practice difficult healthcare conversations in a safe AI roleplay room, then get
              scored, actionable feedback in seconds.
            </p>
            <div className="animate-fade-up animate-fade-up-3 mt-8">
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/scenario"
                  className="btn-shine inline-flex min-h-12 items-center justify-center rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-strong)] px-6 py-3 text-sm font-semibold text-white shadow-[var(--shadow-lift)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(15,118,110,0.32)]"
                >
                  Create a scenario
                </Link>
                <Link
                  href="/how-it-works"
                  className="group inline-flex min-h-12 items-center justify-center gap-2.5 rounded-full border border-teal-200 bg-[var(--color-primary-soft)] px-5 py-3 text-sm font-semibold text-[var(--color-primary-ink)] shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-lift)]"
                >
                  <span
                    aria-hidden
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-[var(--color-primary-strong)] shadow-sm transition-transform duration-300 group-hover:scale-110"
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-3 w-3">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                  See how it works
                </Link>
                <Link
                  href="/simulation"
                  className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold text-[var(--color-ink)] transition-all duration-300 hover:gap-2.5 hover:text-[var(--color-primary-strong)]"
                >
                  Resume simulation
                  <span aria-hidden>&rarr;</span>
                </Link>
              </div>
              <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
                Watch a 30-second walkthrough &mdash; no signup needed.
              </p>
            </div>
          </div>

          <div className="animate-fade-up animate-fade-up-2 relative">
            <HeroChatSnippet
              floatingTag={
                <div className="animate-float pointer-events-none absolute -right-3 -top-5 z-10 flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5 shadow-[var(--shadow-soft)]">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)]">
                    <FocusIcon>
                      <path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 2.5 5 6 5c2 0 3.5 1.2 4 2.5.5-1.3 2-2.5 4-2.5 3.5 0 5.5 3.5 3.5 7.5C19 16.65 12 21 12 21Z" />
                    </FocusIcon>
                  </span>
                  <div className="pr-1">
                    <p className="text-xs font-semibold text-[var(--color-ink)]">Empathy-first</p>
                    <p className="text-[11px] text-[var(--color-ink-soft)]">Roleplay coaching</p>
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </section>

      <MarqueeRibbon />

      <section className="pt-10 sm:pt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary-strong)]">
          Our focus areas
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
          Skills every trainee practices here
        </h2>

        <div className="mt-4 divide-y divide-[var(--color-border)]">
          {focusAreas.map((area) => (
            <div
              key={area.title}
              className="group flex flex-col gap-3 py-5 transition-colors duration-300 hover:bg-[var(--color-surface-muted)]/60 sm:flex-row sm:items-center sm:gap-5 sm:rounded-2xl sm:px-3"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary-ink)] transition-transform duration-300 group-hover:scale-105">
                <FocusIcon>{area.icon}</FocusIcon>
              </span>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-[var(--color-ink)]">{area.title}</h3>
                <p className="mt-1 text-sm leading-6 text-[var(--color-ink-muted)]">{area.description}</p>
              </div>
              <Link
                href="/scenario"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-primary-strong)] transition hover:gap-1.5 hover:text-[var(--color-primary-ink)]"
              >
                Practice this
                <span aria-hidden>&rarr;</span>
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-8 py-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_0.9fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary-strong)]">
            How it works
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
            Three steps to a sharper conversation
          </h2>
          <div className="mt-6 flex flex-col gap-0 sm:flex-row sm:items-start sm:gap-4">
            {workflowSteps.map(([title, body], index) => (
              <div
                key={title}
                className="group relative flex flex-1 gap-3 rounded-2xl p-3 pb-6 transition-colors duration-300 hover:bg-[var(--color-surface-muted)]/70 sm:flex-col sm:gap-0 sm:pb-3"
              >
                <div className="flex items-center gap-3 sm:flex-col sm:items-start sm:gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-strong)] text-sm font-bold text-white shadow-[var(--shadow-lift)] transition-transform duration-300 group-hover:scale-110 group-hover:shadow-[0_16px_30px_rgba(15,118,110,0.35)]">
                    {index + 1}
                  </span>
                  <span
                    aria-hidden
                    className={`hidden h-0.5 flex-1 bg-gradient-to-r from-[var(--color-border-strong)] to-transparent sm:mt-5 sm:block ${
                      index < workflowSteps.length - 1 ? "" : "sm:invisible"
                    }`}
                  />
                </div>
                <div className="sm:mt-3">
                  <h3 className="text-sm font-semibold text-[var(--color-ink)] transition-colors duration-300 group-hover:text-[var(--color-primary-strong)]">
                    {title}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <SafetyNotice />
          <InfoCard label="Start" title="Use one rough idea" tone="emerald">
            <p className="text-sm leading-6">
              Name the patient, pressure point, and skill to practice.
            </p>
            <Link
              href="/scenario"
              className="btn-shine mt-4 inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-strong)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-lift)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(15,118,110,0.32)]"
            >
              Create your first scenario
            </Link>
          </InfoCard>
        </div>
      </section>
    </AppShell>
  );
}
