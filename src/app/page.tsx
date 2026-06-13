import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { SafetyNotice } from "@/components/common/SafetyNotice";

export default function Home() {
  return (
    <AppShell>
      <section className="grid gap-8 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase text-emerald-700">
            Healthcare communication simulation
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-semibold tracking-tight text-slate-950">
            FirstDrop roleplay training for difficult healthcare conversations.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Trainers turn rough scenario notes into structured roleplay sessions.
            Trainees respond step by step, and the app generates feedback on empathy,
            clarity, communication gaps, and pressure handling.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
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
        </div>
        <div className="space-y-5">
          <SafetyNotice />
          <div className="rounded-lg border border-emerald-900/10 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">MVP workflow</h2>
            <div className="mt-5 grid gap-3 text-sm text-slate-700">
              {[
                "Trainer enters a rough communication scenario.",
                "Gemini converts it into a structured roleplay brief.",
                "Trainee responds by typing or speaking.",
                "AI continues the scenario and tracks tension.",
                "Feedback report focuses on communication quality.",
              ].map((item) => (
                <div key={item} className="rounded-md bg-slate-50 px-4 py-3">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
