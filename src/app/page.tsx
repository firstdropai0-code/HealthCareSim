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
      <section className="grid gap-8 py-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase text-emerald-700">
            Healthcare communication training
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-slate-950">
            FirstDropAI
          </h1>
          <p className="mt-4 max-w-3xl text-2xl font-semibold leading-9 text-slate-800">
            Practice difficult healthcare conversations in a safe AI roleplay room.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {focusAreas.map((area) => (
              <MetricChip key={area} label={area} tone="emerald" />
            ))}
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link
              href="/scenario"
              className="min-h-12 rounded-lg bg-emerald-800 px-5 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900"
            >
              Create a scenario
            </Link>
            <Link
              href="/simulation"
              className="min-h-12 rounded-lg border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-600 hover:text-emerald-800"
            >
              Resume simulation
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-900/10 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-emerald-950 px-5 py-4 text-white">
            <p className="text-xs font-semibold uppercase text-emerald-200">
              Simulation preview
            </p>
            <h2 className="mt-1 text-lg font-semibold">Waiting room update</h2>
          </div>
          <div className="space-y-4 p-5">
            <InfoCard label="Scenario" tone="slate">
              <p className="text-sm leading-6">
                An anxious patient asks why no one has explained the delay.
              </p>
            </InfoCard>
            <div className="space-y-3">
              <div className="max-w-[88%] rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm">
                Does anyone know what is happening?
              </div>
              <div className="ml-auto max-w-[88%] rounded-lg bg-emerald-800 px-4 py-3 text-sm leading-6 text-white shadow-sm">
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

      <section className="grid gap-5 py-6 lg:grid-cols-[1fr_0.9fr]">
        <InfoCard label="How it works" title="Three steps" tone="slate">
          <div className="mt-2 grid gap-3 md:grid-cols-3 lg:grid-cols-1">
            {workflowSteps.map(([title, body], index) => (
              <div key={title} className="flex gap-3 rounded-lg bg-slate-50 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">{title}</h3>
                  <p className="mt-1 text-sm text-slate-600">{body}</p>
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
              className="mt-4 inline-flex min-h-11 rounded-lg bg-emerald-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900"
            >
              Create your first scenario
            </Link>
          </InfoCard>
        </div>
      </section>
    </AppShell>
  );
}
