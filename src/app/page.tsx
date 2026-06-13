import Link from "next/link";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import { AppShell } from "@/components/layout/AppShell";

const workflowSteps = [
  {
    title: "Create the brief",
    body: "A trainer writes a rough healthcare communication scenario in plain language.",
  },
  {
    title: "Run the roleplay",
    body: "The trainee responds turn by turn while the scenario adapts to their communication style.",
  },
  {
    title: "Review feedback",
    body: "The report highlights empathy, clarity, pressure handling, and practical next steps.",
  },
];

const focusAreas = ["Empathy", "Clarity", "Listening", "Pressure handling"];

export default function Home() {
  return (
    <AppShell>
      <section className="grid gap-8 py-8 lg:grid-cols-[1fr_440px] lg:items-center">
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
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            FirstDropAI helps trainers turn rough ideas into structured communication
            simulations. Trainees respond as the conversation unfolds, then receive a
            clear feedback report focused on how they communicated.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/scenario"
              className="rounded-lg bg-emerald-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900"
            >
              Create a scenario
            </Link>
            <Link
              href="/simulation"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-600 hover:text-emerald-800"
            >
              Resume simulation
            </Link>
          </div>
          <div className="mt-7 flex flex-wrap gap-2">
            {focusAreas.map((area) => (
              <span
                key={area}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900"
              >
                {area}
              </span>
            ))}
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
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Scenario</p>
              <p className="mt-2 text-sm leading-6 text-slate-800">
                A patient is anxious after a long clinic wait and asks why no one has
                explained the delay.
              </p>
            </div>
            <div className="space-y-3">
              <div className="max-w-[85%] rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm">
                I have been waiting for so long. Does anyone know what is happening?
              </div>
              <div className="ml-auto max-w-[85%] rounded-lg bg-emerald-800 px-4 py-3 text-sm leading-6 text-white shadow-sm">
                I can see this has been frustrating. Let me find the latest update and
                explain what will happen next.
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                ["Turn", "2 / 5"],
                ["Tension", "Medium"],
                ["Score", "8 / 10"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 p-3 text-center">
                  <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 py-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase text-emerald-700">How it works</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3 lg:grid-cols-1">
            {workflowSteps.map((step, index) => (
              <div key={step.title} className="flex gap-4 rounded-lg bg-slate-50 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <SafetyNotice />
          <div className="rounded-lg border border-emerald-900/10 bg-emerald-50 p-6">
            <h2 className="text-xl font-semibold text-emerald-950">
              Start with one rough idea.
            </h2>
            <p className="mt-2 text-sm leading-6 text-emerald-950">
              You do not need a polished script. Describe the patient, the pressure point,
              and what the trainee should practice.
            </p>
            <Link
              href="/scenario"
              className="mt-5 inline-flex rounded-lg bg-emerald-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900"
            >
              Create your first scenario
            </Link>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
