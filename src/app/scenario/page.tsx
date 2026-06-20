"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/common/LoadingButton";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import { VoiceInputButton } from "@/components/common/VoiceInputButton";
import { AppShell } from "@/components/layout/AppShell";
import { ScenarioPreview } from "@/components/scenario/ScenarioPreview";
import { useSpeechToText } from "@/hooks/useSpeechToText";
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
  const handleTranscript = useCallback((text: string) => {
    if (text) {
      setIdea((current) => `${current} ${text}`.trim());
    }
  }, []);
  const speech = useSpeechToText({ onTranscript: handleTranscript });

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
        <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase text-emerald-700">
              Scenario creator
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
              Turn a rough trainer note into a structured roleplay.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Keep it rough. The app will convert the idea into a short training brief
              that is easy to scan before starting.
            </p>
          </div>
          <div className="rounded-lg border border-emerald-900/10 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Workflow</p>
            <div className="mt-3 space-y-3">
              {[
                ["1", "Draft idea"],
                ["2", "Review brief"],
                ["3", "Start roleplay"],
              ].map(([step, label]) => (
                <div key={step} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">
                    {step}
                  </span>
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <SafetyNotice />

        <section className="rounded-lg border border-emerald-900/10 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <label htmlFor="scenario-idea" className="text-sm font-semibold text-slate-900">
                Rough scenario idea
              </label>
              <p className="mt-1 text-xs text-slate-500">
                One or two sentences is enough. Add context, emotion, and pressure point.
              </p>
            </div>
            <p className="text-xs font-medium text-slate-500">{idea.trim().length} characters</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {exampleIdeas.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setIdea(example)}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 transition hover:border-emerald-500"
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
            className="mt-4 w-full resize-y rounded-lg border border-slate-300 bg-white p-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-100"
          />

          {speech.error ? (
            <p className="mt-2 text-sm text-rose-700">{speech.error}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-start gap-3">
            <LoadingButton
              type="button"
              loading={loading}
              disabled={!idea.trim()}
              onClick={handleGenerate}
            >
              Generate Structured Scenario
            </LoadingButton>
            <VoiceInputButton
              supported={speech.supported}
              listening={speech.listening}
              onStart={speech.startListening}
              onStop={speech.stopListening}
            />
            {idea ? (
              <button
                type="button"
                onClick={() => {
                  setIdea("");
                  setScenario(null);
                  setError(null);
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-500"
              >
                Clear
              </button>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          ) : null}
        </section>

        {scenario ? (
          <>
            <ScenarioPreview scenario={scenario} />
            <div className="sticky bottom-4 z-10 rounded-lg border border-emerald-900/10 bg-white/95 p-3 shadow-lg backdrop-blur">
              <button
                type="button"
                onClick={handleStartSimulation}
                className="w-full rounded-lg bg-emerald-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900 md:w-auto"
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
