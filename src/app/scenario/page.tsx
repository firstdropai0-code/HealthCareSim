"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/common/LoadingButton";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import { AppShell } from "@/components/layout/AppShell";
import { ScenarioPreview } from "@/components/scenario/ScenarioPreview";
import { generateScenarioFromIdea } from "@/lib/ai/geminiClient";
import { createInitialSimulationState } from "@/lib/simulation/simulationEngine";
import {
  clearSimulationState,
  saveSimulationState,
} from "@/lib/storage/localSimulationStorage";
import type { Scenario } from "@/types/scenario";

const exampleIdeas = [
  "An anxious patient feels ignored after a long clinic wait.",
  "A family member is upset because updates have been unclear.",
  "A patient is embarrassed and reluctant to ask follow-up questions.",
];

export default function ScenarioCreatorPage() {
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setScenario(null);

    try {
      const nextScenario = await generateScenarioFromIdea(idea);
      setScenario(nextScenario);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate scenario.");
    } finally {
      setLoading(false);
    }
  }

  function handleStartSimulation() {
    if (!scenario) {
      return;
    }

    clearSimulationState();
    saveSimulationState(createInitialSimulationState(scenario));
    router.push("/simulation");
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div>
            <p className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-primary-strong)] shadow-sm">
              Scenario creator
            </p>
            <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
              Turn a rough trainer note into a structured roleplay.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-ink-muted)] sm:text-base sm:leading-7">
              Keep it rough. The app will convert the idea into a short training brief
              that is easy to scan before starting.
            </p>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-soft)]">Workflow</p>
            <div className="mt-4 space-y-3">
              {[
                ["1", "Draft idea"],
                ["2", "Review brief"],
                ["3", "Start roleplay"],
              ].map(([step, label]) => (
                <div key={step} className="flex items-center gap-3 rounded-2xl bg-[var(--color-surface-muted)] p-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-xs font-semibold text-[var(--color-primary-ink)]">
                    {step}
                  </span>
                  <span className="text-sm font-medium text-[var(--color-ink)]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <SafetyNotice />

        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <label htmlFor="scenario-idea" className="text-sm font-semibold text-[var(--color-ink)]">
                Rough scenario idea
              </label>
              <p className="mt-1 text-xs leading-5 text-[var(--color-ink-soft)]">
                One or two sentences is enough. Add context, emotion, and pressure point.
              </p>
            </div>
            <p className="text-xs font-medium text-[var(--color-ink-soft)]">{idea.trim().length} characters</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {exampleIdeas.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setIdea(example)}
                className="min-h-11 rounded-full border border-teal-200 bg-[var(--color-primary-soft)] px-4 py-2 text-xs font-semibold text-[var(--color-primary-ink)] transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:bg-white"
              >
                {example}
              </button>
            ))}
          </div>

          <textarea
            id="scenario-idea"
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            rows={6}
            placeholder="Example: A worried parent is frustrated after waiting in a clinic and wants clearer updates from the doctor."
            className="mt-4 w-full resize-y rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] p-4 text-sm leading-6 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-primary)] focus:bg-white focus:ring-4 focus:ring-teal-100"
          />

          <div className="mt-5 flex flex-wrap items-start gap-3">
            <LoadingButton
              type="button"
              loading={loading}
              disabled={!idea.trim()}
              onClick={handleGenerate}
            >
              Generate Structured Scenario
            </LoadingButton>
            {idea ? (
              <button
                type="button"
                onClick={() => {
                  setIdea("");
                  setScenario(null);
                  setError(null);
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-ink)] shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-slate-500"
              >
                Clear
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="mt-5 rounded-2xl border border-teal-200 bg-[var(--color-primary-soft)] px-4 py-3 text-sm text-[var(--color-primary-ink)]">
              Building the scenario brief. This can take a few seconds when the simulator is busy.
            </div>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
              {error}
            </div>
          ) : null}
        </section>

        {scenario ? (
          <>
            <ScenarioPreview scenario={scenario} />
            <div className="sticky bottom-4 z-10 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[rgba(255,255,255,0.92)] p-3 shadow-[var(--shadow-soft)] backdrop-blur-xl">
              <button
                type="button"
                onClick={handleStartSimulation}
                className="w-full rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-lift)] transition hover:-translate-y-0.5 hover:bg-[var(--color-primary-strong)] md:w-auto"
              >
                Start Simulation
              </button>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
