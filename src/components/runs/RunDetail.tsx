"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MetricChip } from "@/components/common/VisualCards";
import { FeedbackReportView } from "@/components/feedback/FeedbackReportView";
import { Reveal } from "@/components/motion/Reveal";
import { ChatMessageList } from "@/components/simulation/ChatMessageList";
import { useLanguage } from "@/lib/i18n/languageStore";
import { categoryLabel, useT } from "@/lib/i18n/strings";
import { getRun, getRunTranscript } from "@/lib/runs/runRepository";
import { languageDateLocale, type AppLanguage } from "@/types/language";
import type { RunRecord, RunTranscript } from "@/types/run";
import { RunNoteSection } from "./RunNoteSection";

/** Who is looking at the run. Changes the frame around it, never the run. */
export type RunViewer = "mentor" | "owner";

function formatDate(iso: string, language: AppLanguage): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(languageDateLocale[language], {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

/**
 * One completed run: its header, the feedback deck and the full transcript.
 *
 * Shared by the mentor's review page and the trainee's own history, so the two
 * can never drift into showing different versions of the same report. `viewer`
 * only decides where "back" leads and whether the trainee is named. It grants
 * nothing: `runs/{runId}` and its transcript are readable by the run's owner
 * and by its mentor under the rules, and anyone else gets the not-found state
 * because the read itself is refused.
 *
 * Renders content only. The page keeps the gate and the AppShell, like every
 * other page.
 */
export function RunDetail({ runId, viewer }: { runId: string; viewer: RunViewer }) {
  const t = useT();
  const language = useLanguage();
  // For the load effect, which must not refetch when only the language changes.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

  const [run, setRun] = useState<RunRecord | null>(null);
  const [transcript, setTranscript] = useState<RunTranscript | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Which run the state above belongs to, not merely that a fetch finished:
  // moving between two runs reuses this component, and a boolean latch would
  // show the previous run's report under the new address until the fetch lands.
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null);

  const loaded = loadedRunId === runId;

  useEffect(() => {
    if (!runId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [nextRun, nextTranscript] = await Promise.all([
          getRun(runId),
          getRunTranscript(runId),
        ]);

        if (!cancelled) {
          setRun(nextRun);
          setTranscript(nextTranscript);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setRun(null);
          setTranscript(null);
          /*
           * A refused read IS the not-found case, so it gets the not-found
           * copy rather than Firestore's own "Missing or insufficient
           * permissions". The read rule compares fields on the run, and a run
           * that does not exist has no fields to compare — so a mistyped or
           * stale link is denied exactly like somebody else's run, and neither
           * should be told which it was. Anything else (offline, quota) is a
           * real failure and keeps its message.
           */
          const denied = (err as { code?: unknown } | null)?.code === "permission-denied";
          setError(
            denied
              ? null
              : err instanceof Error
                ? err.message
                : tRef.current("run.loadError"),
          );
        }
      } finally {
        if (!cancelled) {
          setLoadedRunId(runId);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [runId]);

  if (!loaded) {
    return <p className="text-sm text-[var(--color-ink-soft)]">{t("run.loading")}</p>;
  }

  if (!run) {
    return (
      <div className="mx-auto max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-soft)]">
        <h1 className="display-sm">{t("run.notFound")}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--color-ink-soft)]">
          {error ?? t(viewer === "mentor" ? "run.notFoundBody" : "ownRun.notFoundBody")}
        </p>
        <Link
          href={viewer === "mentor" ? "/mentor" : "/progress"}
          className="btn-editorial btn-editorial--quiet mt-5 inline-flex"
        >
          {t(viewer === "mentor" ? "run.backDashboard" : "ownRun.backToProgress")}
        </Link>
      </div>
    );
  }

  const scenarioMessages =
    transcript?.messages.filter((message) => message.role === "scenario") ?? [];

  return (
    <div className="space-y-6">
      <Reveal className="accent-edge rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <Link
          href={viewer === "mentor" ? `/mentor/trainee/${run.userId}` : "/progress"}
          className="link-editorial text-xs font-medium text-[var(--color-primary)]"
        >
          {viewer === "mentor"
            ? t("run.backTo", { name: run.userDisplayName })
            : t("ownRun.back")}
        </Link>
        <h1 className="display-md mt-2 max-w-3xl">{run.scenarioTitle}</h1>
        <p className="mt-2 max-w-3xl text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
          {run.scenarioSummary}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* A trainee reading their own run does not need telling whose it is. */}
          {viewer === "mentor" ? (
            <MetricChip label={t("run.trainee")} value={run.userDisplayName} tone="slate" />
          ) : null}
          <MetricChip
            label={t("run.completed")}
            value={formatDate(run.completedAt, language)}
            tone="slate"
          />
          <MetricChip label={t("run.level")} value={t(`difficulty.${run.difficulty}`)} tone="blue" />
          {run.category ? (
            <MetricChip label={t("run.track")} value={categoryLabel(t, run.category)} tone="indigo" />
          ) : null}
          <MetricChip
            label={t("run.endedIn")}
            value={t.plural("common.turns", run.turnCount)}
            tone="slate"
          />
          {run.score === null ? (
            <MetricChip label={t("run.notScored")} tone="amber" />
          ) : (
            <MetricChip label={t("run.score")} value={`${run.score} / 10`} tone="emerald" />
          )}
        </div>
      </Reveal>

      {/* Above the report, so the trainee reads their mentor before the model.
          Skipped on a mentor's own practice run: there is nobody to write to. */}
      {run.userId !== run.mentorId ? <RunNoteSection run={run} viewer={viewer} /> : null}

      {/* The same deck the trainee saw when the run ended — no mentor-only or
          history-only variant to drift. */}
      <FeedbackReportView report={run.report} scenarioMessages={scenarioMessages} />

      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
        <h2 className="display-sm">{t("run.transcript")}</h2>
        {transcript ? (
          <div className="mt-4">
            {/* Read-only: onSpeak is omitted, so no playback controls render. */}
            <ChatMessageList messages={transcript.messages} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--color-ink-soft)]">{t("run.noTranscript")}</p>
        )}
      </section>
    </div>
  );
}
