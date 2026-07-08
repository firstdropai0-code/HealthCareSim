"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FeedbackReportView } from "@/components/feedback/FeedbackReportView";
import { LoadingButton } from "@/components/common/LoadingButton";
import { SafetyNotice } from "@/components/common/SafetyNotice";
import { AppShell } from "@/components/layout/AppShell";
import { generateFeedbackReport } from "@/lib/ai/geminiClient";
import { exportFeedback } from "@/lib/export/exportFeedback";
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
  const autoGenerationStartedRef = useRef(false);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate feedback.");
    } finally {
      setLoading(false);
    }
  }, [report, state]);

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

  if (!hasLoaded) {
    return (
      <AppShell>
        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-[var(--shadow-soft)]">
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">Loading feedback</h1>
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">Preparing the feedback page.</p>
        </section>
      </AppShell>
    );
  }

  if (!state) {
    return (
      <AppShell>
        <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center shadow-[var(--shadow-soft)]">
          <h1 className="text-2xl font-semibold text-[var(--color-ink)]">No simulation to review</h1>
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
            Run a simulation before generating a feedback report.
          </p>
          <Link
            href="/scenario"
            className="btn-shine mt-6 inline-flex min-h-11 items-center rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-strong)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-lift)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(15,118,110,0.32)]"
          >
            Create scenario
          </Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="animate-fade-up space-y-6">
        <div className="relative overflow-hidden">
          <div
            aria-hidden
            className="animate-float pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[var(--color-primary)]/14 blur-3xl"
          />
          <p className="relative inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-primary-strong)] shadow-sm">
            Feedback report
          </p>
          <h1 className="relative mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
            {state.scenario.title}
          </h1>
          <p className="relative mt-3 max-w-3xl text-sm leading-6 text-[var(--color-ink-muted)] sm:text-base sm:leading-7">
            Feedback is limited to communication behaviors and training performance.
          </p>
        </div>
        <SafetyNotice />
        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]">
            {error}
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={loading}
              className="ml-3 font-semibold underline disabled:text-rose-300"
            >
              Retry
            </button>
          </div>
        ) : null}
        {loading ? (
          <section className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-xl font-semibold text-[var(--color-ink)]">
              Generating AI feedback...
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
              The report will focus on communication, empathy, clarity, and pressure handling.
            </p>
          </section>
        ) : !report ? (
          <section className="grid gap-5 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)] lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-ink)]">
                Ready to generate AI feedback
              </h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">
                The report is formatted as a quick dashboard first, with detailed notes
                available underneath.
              </p>
              <LoadingButton
                type="button"
                loading={loading}
                onClick={handleGenerateReport}
                className="mt-5"
              >
                Generate Feedback
              </LoadingButton>
            </div>
            <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-soft)]">
                Report sections
              </p>
              <div className="mt-3 grid gap-2 text-sm text-[var(--color-ink-muted)]">
                {["Score", "Quick read", "Strengths", "Improve next", "Practice responses"].map(
                  (section) => (
                    <div key={section} className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                      {section}
                    </div>
                  ),
                )}
              </div>
            </div>
          </section>
        ) : (
          <>
            <FeedbackReportView report={report} />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => exportFeedback(state, report)}
                className="btn-shine min-h-11 rounded-full bg-gradient-to-r from-[var(--color-info)] to-blue-900 px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_rgba(49,86,163,0.32)]"
              >
                Export feedback as .txt
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="min-h-11 rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-5 py-3 text-sm font-semibold text-[var(--color-ink)] shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:text-[var(--color-primary-strong)]"
              >
                Restart
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
