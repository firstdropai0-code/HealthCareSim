"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { springSoft } from "@/components/motion/motionConfig";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";
import { LoadingButton } from "@/components/common/LoadingButton";
import { MicButton } from "@/components/common/MicButton";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import { AppShell } from "@/components/layout/AppShell";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
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
  const shouldAnimate = useShouldAnimate();
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
      setScenario({
        ...nextScenario,
        defaultEvaluationCriteria: [...nextScenario.evaluationCriteria],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate scenario.");
    } finally {
      setLoading(false);
    }
  }

  function handleTranscript(text: string) {
    setIdea((current) => (current.trim() ? `${current.trim()} ${text}` : text));
  }

  function handleScenarioChange(updates: Partial<Scenario>) {
    setScenario((current) => (current ? { ...current, ...updates } : current));
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
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <RevealGroup stagger={0.08}>
            <RevealItem>
              <p className="eyebrow inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[var(--color-primary)] shadow-[var(--shadow-card)]">
                <span aria-hidden className="halo h-1.5 w-1.5 rounded-full bg-[var(--color-primary)]" />
                Scenario creator
              </p>
            </RevealItem>
            <RevealItem>
              <h1 className="display-xl mt-4 max-w-3xl">
                Turn a rough note into a structured roleplay.
              </h1>
            </RevealItem>
            <RevealItem>
              <p className="lede mt-4 max-w-2xl">
                Keep it rough. The app will convert the idea into a short training brief
                that is easy to scan before starting.
              </p>
            </RevealItem>
          </RevealGroup>

          <Reveal delay={0.12} className="border-t border-[var(--color-border)] pt-6">
            <p className="eyebrow text-[var(--color-ink-soft)]">Workflow</p>
            <ol className="mt-4">
              {[
                ["01", "Draft idea"],
                ["02", "Review brief"],
                ["03", "Start roleplay"],
              ].map(([step, label]) => (
                <li
                  key={step}
                  className="group flex items-baseline gap-4 border-b border-[var(--color-border)] py-3 transition-colors duration-300 hover:border-[var(--color-primary)]"
                >
                  <span className="section-num">{step}</span>
                  <span className="text-sm text-[var(--color-ink)] transition-colors duration-300 group-hover:text-[var(--color-primary)]">
                    {label}
                  </span>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>

        <SafetyNotice />

        <Reveal
          as="section"
          className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)] sm:p-6"
        >
          <div className="flex flex-col gap-3 border-b border-[var(--color-border)] pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <label htmlFor="scenario-idea" className="eyebrow text-[var(--color-ink)]">
                Rough scenario idea
              </label>
              <p className="mt-2 text-xs leading-5 text-[var(--color-ink-soft)]">
                One or two sentences is enough. Add context, emotion, and pressure point.
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <p className="text-xs font-medium tabular-nums text-[var(--color-ink-soft)]">
                {idea.trim().length} chars
              </p>
              <MicButton onTranscript={handleTranscript} disabled={loading} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {exampleIdeas.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setIdea(example)}
                className="min-h-10 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-canvas-soft)] px-3 py-2 text-left text-xs leading-5 text-[var(--color-ink-muted)] transition-colors duration-200 hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary-ink)]"
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
            className="mt-5 w-full resize-y border border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] p-4 text-sm leading-7 text-[var(--color-ink)] outline-none transition focus:border-[var(--color-ink)] focus:bg-white"
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
                className="btn-editorial btn-editorial--quiet"
              >
                Clear
              </button>
            ) : null}
          </div>

          {loading ? (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-primary)] bg-[var(--color-primary-soft)] px-4 py-3 text-sm">
              <span className="shimmer-text font-medium">
                Building the scenario brief. This can take a few seconds when the simulator is busy.
              </span>
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
              {error}
            </div>
          ) : null}
        </Reveal>

        {scenario ? (
          <>
            <ScenarioPreview scenario={scenario} onScenarioChange={handleScenarioChange} />
            {(() => {
              const barClass =
                "glass sticky bottom-4 z-10 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] p-3 shadow-[var(--shadow-lift)]";
              const cta = (
                <button
                  type="button"
                  onClick={handleStartSimulation}
                  className="btn-editorial btn-editorial--accent sheen w-full md:w-auto"
                >
                  Start Simulation
                </button>
              );

              // Plain element when animation is off, so the primary action is
              // never left invisible by an entrance that did not run.
              return shouldAnimate ? (
                <motion.div
                  className={barClass}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springSoft}
                >
                  {cta}
                </motion.div>
              ) : (
                <div className={barClass}>{cta}</div>
              );
            })()}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
