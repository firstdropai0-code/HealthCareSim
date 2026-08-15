"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth/AuthGate";
import { FeedbackReportView } from "@/components/feedback/FeedbackReportView";
import { LoadingButton } from "@/components/common/LoadingButton";
import { MetricChip } from "@/components/common/VisualCards";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import { AppShell } from "@/components/layout/AppShell";
import { Reveal } from "@/components/motion/Reveal";
import { generateFeedbackReport } from "@/lib/ai/geminiClient";
import { exportFeedback } from "@/lib/export/exportFeedback";
import { getScenarioMessages } from "@/lib/feedback/betterResponses";
import { useRequireAuth } from "@/lib/firebase/useAuth";
import { saveCompletedRun } from "@/lib/runs/runRepository";
import {
  clearPendingFeedbackGeneration,
  clearSimulationState,
  loadFeedbackReport,
  loadPendingFeedbackGeneration,
  loadSimulationState,
  saveFeedbackReport,
  saveSimulationState,
} from "@/lib/storage/localSimulationStorage";
import type { FeedbackReport } from "@/types/feedback";
import type { SimulationState } from "@/types/simulation";

export default function FeedbackPage() {
  const router = useRouter();
  const gate = useRequireAuth();
  const profile = gate.blocked ? null : gate.profile;
  const autoGenerationStartedRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [pendingAutoGenerate, setPendingAutoGenerate] = useState(false);
  const [state, setState] = useState<SimulationState | null>(null);
  const [report, setReport] = useState<FeedbackReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedState = loadSimulationState();
      const savedReport = loadFeedbackReport();
      const shouldAutoGenerate = loadPendingFeedbackGeneration();

      setState(savedState);
      setReport(savedReport);
      setPendingAutoGenerate(shouldAutoGenerate);
      setHasLoaded(true);

      if (savedReport) {
        clearPendingFeedbackGeneration();
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const handleGenerateReport = useCallback(async () => {
    if (!state) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const completedState: SimulationState = { ...state, status: "completed" };
      const nextReport = await generateFeedbackReport(completedState);

      if (nextReport.source === "fallback" && report?.source === "ai") {
        setPendingAutoGenerate(false);
        clearPendingFeedbackGeneration();
        return;
      }

      setState(completedState);
      setReport(nextReport);
      setPendingAutoGenerate(false);
      saveSimulationState(completedState);
      saveFeedbackReport(nextReport);
      clearPendingFeedbackGeneration();

      // The one and only Firestore write for a run. Awaited so the chip can
      // report the outcome, but never fatal: a failed save must not cost the
      // trainee the report they just earned. The run id is deterministic, so
      // retrying overwrites rather than duplicating.
      if (profile?.groupId) {
        setSaveStatus("saving");
        try {
          await saveCompletedRun({
            state: completedState,
            report: nextReport,
            profile,
          });
          setSaveStatus("saved");
        } catch {
          setSaveStatus("failed");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate feedback.");
    } finally {
      setLoading(false);
    }
  }, [profile, report, state]);

  useEffect(() => {
    if (
      !hasLoaded ||
      !state ||
      report ||
      loading ||
      autoGenerationStartedRef.current ||
      (state.status !== "completed" && !pendingAutoGenerate)
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      autoGenerationStartedRef.current = true;
      void handleGenerateReport();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [handleGenerateReport, hasLoaded, loading, pendingAutoGenerate, report, state]);

  function handleRestart() {
    clearSimulationState();
    router.push("/scenario");
  }

  async function handleRetrySave() {
    if (!state || !report || !profile?.groupId) {
      return;
    }

    setSaveStatus("saving");
    try {
      await saveCompletedRun({ state, report, profile });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("failed");
    }
  }

  if (gate.blocked) {
    return <AuthGate gate={gate} />;
  }

  if (!hasLoaded) {
    return (
      <AppShell>
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-card)]">
          <p className="eyebrow text-[var(--color-ink-soft)]">Feedback report</p>
          <h1 className="display-md mt-4 text-[var(--color-ink)]">Loading feedback</h1>
          <p className="lede mt-5 text-sm">Preparing the feedback page.</p>
        </section>
      </AppShell>
    );
  }

  if (!state) {
    return (
      <AppShell>
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-card)]">
          <p className="eyebrow text-[var(--color-ink-soft)]">Feedback report</p>
          <h1 className="display-md mt-4 text-[var(--color-ink)]">No simulation to review</h1>
          <p className="lede mt-5 max-w-lg text-sm">
            Run a simulation before generating a feedback report.
          </p>
          <Link href="/scenario" className="btn-editorial btn-editorial--solid mt-8">
            Create scenario
          </Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <Reveal className="accent-edge rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <p className="eyebrow text-[var(--color-primary)]">Feedback report</p>
          <h1 className="display-md mt-2 max-w-3xl">{state.scenario.title}</h1>
          {/* What was practised and how long it ran, so the report opens with
              the context it is judging rather than a bare score. */}
          <p className="mt-2 max-w-3xl text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
            {state.scenario.summary}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MetricChip label="Setting" value={state.scenario.setting} tone="emerald" />
            <MetricChip
              label="Ended in"
              value={`${state.currentTurn} ${state.currentTurn === 1 ? "turn" : "turns"}`}
              tone="blue"
            />
            <MetricChip label="Goal" value={state.scenario.traineeObjective} tone="slate" />
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--color-ink-soft)]">
            Feedback is limited to communication behaviors and training performance.
          </p>
        </Reveal>
        <SafetyNotice />
        {error ? (
          <div className="rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
            {error}
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={loading}
              className="ml-3 font-semibold underline disabled:opacity-50"
            >
              Retry
            </button>
          </div>
        ) : null}
        {loading ? (
          <section className="accent-edge rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]">
            <p className="eyebrow text-[var(--color-primary)]">Working</p>
            <h2 className="display-md mt-3 text-[var(--color-ink)]">
              <span className="shimmer-text">Generating AI feedback</span>
            </h2>
            <p className="lede mt-3 max-w-xl text-sm">
              The report will focus on communication, empathy, clarity, and pressure handling.
            </p>
            <div className="mt-5 flex gap-1.5" aria-hidden>
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-primary)]"
                  style={{ animationDelay: `${dot * 0.15}s` }}
                />
              ))}
            </div>
          </section>
        ) : !report ? (
          <section className="grid gap-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)] lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="eyebrow text-[var(--color-ink-soft)]">Ready</p>
              <h2 className="display-md mt-4 text-[var(--color-ink)]">
                Ready to generate AI feedback
              </h2>
              <p className="lede mt-5 max-w-xl text-sm">
                The report is formatted as a quick dashboard first, with detailed notes
                available underneath.
              </p>
              <LoadingButton
                type="button"
                loading={loading}
                onClick={handleGenerateReport}
                className="mt-8"
              >
                Generate Feedback
              </LoadingButton>
            </div>
            <div className="border-t border-[var(--color-border)] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <p className="eyebrow text-[var(--color-ink-soft)]">Report sections</p>
              <ol className="mt-4">
                {["Score", "Quick read", "Strengths", "Improve next", "Practice responses"].map(
                  (section, index) => (
                    <li
                      key={section}
                      className="flex items-baseline gap-4 border-b border-[var(--color-border)] py-2.5"
                    >
                      <span className="section-num">{String(index + 1).padStart(2, "0")}</span>
                      <span className="text-sm text-[var(--color-ink-muted)]">{section}</span>
                    </li>
                  ),
                )}
              </ol>
            </div>
          </section>
        ) : (
          <>
            <FeedbackReportView
              report={report}
              scenarioMessages={getScenarioMessages(state)}
            />
            {/* Session actions sit below the deck: they act on the whole
                report, not on whichever page happens to be open. */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs leading-5 text-[var(--color-ink-soft)]">
                  Keep a copy of this report, or start a new scenario.
                </p>
                {saveStatus === "saving" ? (
                  <MetricChip label="Saving to your record" tone="slate" />
                ) : saveStatus === "saved" ? (
                  <MetricChip label="Saved to your record" tone="emerald" />
                ) : saveStatus === "failed" ? (
                  <button type="button" onClick={() => void handleRetrySave()}>
                    <MetricChip label="Not saved" value="Retry" tone="rose" />
                  </button>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => exportFeedback(state, report)}
                  className="btn-editorial btn-editorial--solid"
                >
                  Export feedback as .txt
                </button>
                <button
                  type="button"
                  onClick={handleRestart}
                  className="btn-editorial btn-editorial--quiet"
                >
                  Restart
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
