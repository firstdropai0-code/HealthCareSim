import Link from "next/link";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import { InfoCard, MetricChip, StepProgress } from "@/components/common/VisualCards";
import { AppShell } from "@/components/layout/AppShell";

const workflowSteps = [
  ["Create", "Rough note to brief"],
  ["Practice", "Adaptive roleplay"],
  ["Review", "Scan feedback"],
];

const focusAreas = ["Empathy", "Clarity", "Listening", "Pressure handling"];

export default function Home() {
  return (
    <AppShell>
      <section className="grid gap-8 pb-8 pt-3 lg:grid-cols-[minmax(0,1fr)_430px] lg:items-center lg:pb-12 lg:pt-8">
        <div className="max-w-3xl">
          <p className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-primary-strong)] shadow-sm">
            Healthcare communication training
          </p>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-5xl lg:text-6xl">
            FirstDropAI
          </h1>
          <p className="mt-4 max-w-2xl text-xl font-medium leading-8 text-[var(--color-ink-muted)] sm:text-2xl sm:leading-9">
            Practice difficult healthcare conversations in a safe AI roleplay room.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {focusAreas.map((area) => (
              <MetricChip key={area} label={area} tone="emerald" />
            ))}
          </div>
          <div className="mt-8 grid gap-3 sm:max-w-xl sm:grid-cols-2">
            <Link
              href="/scenario"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-center text-sm font-semibold text-white shadow-[var(--shadow-lift)] transition hover:-translate-y-0.5 hover:bg-[var(--color-primary-strong)]"
            >
              Create a scenario
            </Link>
            <Link
              href="/simulation"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-5 py-3 text-center text-sm font-semibold text-[var(--color-ink)] shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:text-[var(--color-primary-strong)]"
            >
              Resume simulation
            </Link>
          </div>
        </div>

        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
          <div className="bg-[var(--color-primary-ink)] px-5 py-5 text-white sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-100">
              Simulation preview
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Waiting room update</h2>
          </div>
          <div className="space-y-5 p-5 sm:p-6">
            <InfoCard label="Scenario" tone="slate">
              <p className="text-sm leading-6">
                An anxious patient asks why no one has explained the delay.
              </p>
            </InfoCard>
            <div className="space-y-3">
              <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--color-ink)] shadow-sm">
                Does anyone know what is happening?
              </div>
              <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-[var(--color-primary)] px-4 py-3 text-sm leading-6 text-white shadow-[var(--shadow-card)]">
                I can see this is frustrating. I will get the latest update.
              </div>
            </div>
            <StepProgress current={2} total={5} />
            <div className="flex flex-wrap gap-2">
              <MetricChip label="Tension" value="Medium" tone="amber" />
              <MetricChip label="Score" value="8 / 10" tone="blue" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 py-6 lg:grid-cols-[minmax(0,1fr)_0.9fr]">
        <InfoCard label="How it works" title="Three steps" tone="slate">
          <div className="mt-3 grid gap-3 md:grid-cols-3 lg:grid-cols-1">
            {workflowSteps.map(([title, body], index) => (
              <div key={title} className="flex gap-3 rounded-2xl bg-[var(--color-surface-muted)] p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-sm font-semibold text-[var(--color-primary-ink)]">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h3>
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </InfoCard>

        <div className="space-y-5">
          <SafetyNotice />
          <InfoCard label="Start" title="Use one rough idea" tone="emerald">
            <p className="text-sm leading-6">
              Name the patient, pressure point, and skill to practice.
            </p>
            <Link
              href="/scenario"
              className="mt-4 inline-flex min-h-11 items-center rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-lift)] transition hover:-translate-y-0.5 hover:bg-[var(--color-primary-strong)]"
            >
              Create your first scenario
            </Link>
          </InfoCard>
        </div>
      </section>
    </AppShell>
  );
}
