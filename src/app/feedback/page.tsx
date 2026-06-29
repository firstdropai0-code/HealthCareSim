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
        <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">Loading feedback</h1>
          <p className="mt-3 text-sm text-slate-600">Preparing the feedback page.</p>
        </section>
      </AppShell>
    );
  }

  if (!state) {
    return (
      <AppShell>
        <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">No simulation to review</h1>
          <p className="mt-3 text-sm text-slate-600">
            Run a simulation before generating a feedback report.
          </p>
          <Link
            href="/scenario"
            className="mt-6 inline-flex rounded-lg bg-emerald-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-900"
          >
            Create scenario
          </Link>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase text-emerald-700">
            Feedback report
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {state.scenario.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Feedback is limited to communication behaviors and training performance.
          </p>
        </div>
        <SafetyNotice />
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
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
          <section className="rounded-lg border border-emerald-900/10 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-950">
              Generating AI feedback...
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The report will focus on communication, empathy, clarity, and pressure handling.
            </p>
          </section>
        ) : !report ? (
          <section className="grid gap-5 rounded-lg border border-emerald-900/10 bg-white p-6 shadow-sm lg:grid-cols-[1fr_320px]">
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                Ready to generate AI feedback
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
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
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Report sections
              </p>
              <div className="mt-3 grid gap-2 text-sm text-slate-700">
                {["Score", "Quick read", "Strengths", "Improve next", "Practice responses"].map(
                  (section) => (
                    <div key={section} className="rounded-md bg-white px-3 py-2">
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
                className="rounded-lg bg-blue-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-900"
              >
                Export feedback as .txt
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-600 hover:text-emerald-800"
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
