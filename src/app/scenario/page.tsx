"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { springSoft } from "@/components/motion/motionConfig";
import { useShouldAnimate } from "@/components/motion/useShouldAnimate";
import { AuthGate } from "@/components/auth/AuthGate";
import { LoadingButton } from "@/components/common/LoadingButton";
import { MicButton } from "@/components/common/MicButton";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import { AppShell } from "@/components/layout/AppShell";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import {
  CategorySelector,
  DifficultySelector,
} from "@/components/scenario/DifficultySelector";
import { ScenarioLibraryBar } from "@/components/scenario/ScenarioLibrary";
import { ScenarioPreview } from "@/components/scenario/ScenarioPreview";
import { generateScenarioFromIdea } from "@/lib/ai/geminiClient";
import { publishCase } from "@/lib/cases/caseRepository";
import { useRequireAuth } from "@/lib/firebase/useAuth";
import {
  GENERAL_CATEGORY,
  difficultyMeta,
  type LibraryScenario,
  type ScenarioDifficulty,
} from "@/lib/scenarios/scenarioLibrary";
import { createInitialSimulationState } from "@/lib/simulation/simulationEngine";
import {
  clearSimulationState,
  saveSimulationState,
} from "@/lib/storage/localSimulationStorage";
import type { Scenario } from "@/types/scenario";

export default function ScenarioCreatorPage() {
  const shouldAnimate = useShouldAnimate();
  const router = useRouter();
  // "mentor" rather than any signed-in user: trainees pick from published cases
  // instead of authoring their own. Still passes through when Firebase is
  // unconfigured, so the standalone demo keeps working.
  const gate = useRequireAuth("mentor");
  const profile = gate.blocked ? null : gate.profile;
  const [idea, setIdea] = useState("");
  // The whole entry is kept, not just the id: `category` travels with the run
  // and is what groups the skill tree into tracks.
  const [libraryEntry, setLibraryEntry] = useState<LibraryScenario | null>(null);
  const [difficulty, setDifficulty] = useState<ScenarioDifficulty>("intermediate");
  const [category, setCategory] = useState<string>(GENERAL_CATEGORY);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishState, setPublishState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  // The tier the current preview was actually generated at. Changing the chips
  // afterwards only relabels it, so the mismatch needs saying out loud.
  const [generatedDifficulty, setGeneratedDifficulty] = useState<ScenarioDifficulty | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setScenario(null);

    try {
      const nextScenario = await generateScenarioFromIdea(idea, difficulty);
      setScenario({
        ...nextScenario,
        defaultEvaluationCriteria: [...nextScenario.evaluationCriteria],
        // Attached client-side. The model never sees or invents these.
        ...(libraryEntry ? { libraryId: libraryEntry.id } : {}),
        // Always set, never only when a library case was picked. A scenario with
        // no track has no row on the skill tree and vanishes from progress.
        category,
        difficulty,
      });
      setGeneratedDifficulty(difficulty);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate scenario.");
    } finally {
      setLoading(false);
    }
  }

  function handleTranscript(text: string) {
    setLibraryEntry(null);
    setIdea((current) => (current.trim() ? `${current.trim()} ${text}` : text));
  }

  function handleLibraryPick(entry: LibraryScenario) {
    setIdea(entry.idea);
    setLibraryEntry(entry);
    setDifficulty(entry.difficulty);
    setCategory(entry.category);
    setScenario(null);
    setError(null);
  }

  function handleIdeaChange(next: string) {
    setIdea(next);
    // Once the trainer edits the text it is no longer that library case, so the
    // marker in the bar is dropped rather than left claiming something stale.
    // The difficulty they were shown is kept — it is still the tier they chose,
    // and every run needs one.
    setLibraryEntry(null);
  }

  function handleScenarioChange(updates: Partial<Scenario>) {
    setScenario((current) => (current ? { ...current, ...updates } : current));
    // Any edit makes the published copy stale, so the confirmation is dropped.
    setPublishState("idle");
  }

  async function handlePublish() {
    if (!scenario || !profile) {
      return;
    }

    setPublishState("saving");

    try {
      await publishCase(profile, scenario);
      setPublishState("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish this case.");
      setPublishState("failed");
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

  if (gate.blocked) {
    return <AuthGate gate={gate} />;
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

          <div className="mt-5">
            <ScenarioLibraryBar
              selectedId={libraryEntry?.id ?? null}
              onSelect={handleLibraryPick}
              disabled={loading}
            />
          </div>

          <div className="mt-5 border-t border-[var(--color-border)] pt-5">
            <DifficultySelector
              value={difficulty}
              onChange={(next) => {
                setDifficulty(next);
                setPublishState("idle");
              }}
              locked={Boolean(libraryEntry)}
              disabled={loading}
            />

            <div className="mt-5">
              <CategorySelector
                value={category}
                onChange={(next) => {
                  setCategory(next);
                  setPublishState("idle");
                }}
                locked={Boolean(libraryEntry)}
                disabled={loading}
              />
            </div>

            {scenario && generatedDifficulty && generatedDifficulty !== difficulty ? (
              <p className="mt-3 rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-warning)] bg-[var(--color-warning-soft)] px-3 py-2 text-xs leading-5">
                The brief below was written at{" "}
                <strong>{difficultyMeta[generatedDifficulty].label.toLowerCase()}</strong> level.
                Generate again to rewrite it at{" "}
                <strong>{difficultyMeta[difficulty].label.toLowerCase()}</strong>, or publish as is
                to keep this brief under the new label.
              </p>
            ) : null}
          </div>

          <textarea
            id="scenario-idea"
            value={idea}
            onChange={(event) => handleIdeaChange(event.target.value)}
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
                  setLibraryEntry(null);
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
              const canPublish = Boolean(profile?.groupId);
              const cta = (
                <div className="flex flex-wrap items-center gap-2">
                  {canPublish ? (
                    <button
                      type="button"
                      onClick={() => void handlePublish()}
                      disabled={publishState === "saving"}
                      className="btn-editorial btn-editorial--accent sheen w-full md:w-auto"
                    >
                      {publishState === "saving"
                        ? "Publishing..."
                        : publishState === "saved"
                          ? "Published to group"
                          : "Publish to my group"}
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleStartSimulation}
                    className={`btn-editorial w-full md:w-auto ${
                      canPublish ? "btn-editorial--quiet" : "btn-editorial--accent sheen"
                    }`}
                  >
                    {canPublish ? "Test run it yourself" : "Start Simulation"}
                  </button>

                  {publishState === "saved" ? (
                    <Link
                      href="/cases"
                      className="link-editorial text-xs font-medium text-[var(--color-primary)]"
                    >
                      View published cases
                    </Link>
                  ) : null}

                  {profile && !profile.groupId ? (
                    <p className="text-xs leading-5 text-[var(--color-ink-soft)]">
                      <Link href="/mentor/group" className="link-editorial font-medium">
                        Create a group
                      </Link>{" "}
                      to publish this to trainees.
                    </p>
                  ) : null}
                </div>
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
