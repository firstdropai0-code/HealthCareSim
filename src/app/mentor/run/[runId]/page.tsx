"use client";

import { categoryLabel, useT } from "@/lib/i18n/strings";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { MetricChip } from "@/components/common/VisualCards";
import { FeedbackReportView } from "@/components/feedback/FeedbackReportView";
import { AppShell } from "@/components/layout/AppShell";
import { Reveal } from "@/components/motion/Reveal";
import { ChatMessageList } from "@/components/simulation/ChatMessageList";
import { useRequireBackend } from "@/lib/firebase/useAuth";
import { getRun, getRunTranscript } from "@/lib/runs/runRepository";
import type { RunRecord, RunTranscript } from "@/types/run";

export default function MentorRunPage() {
  const t = useT();
  // For the load effect, which must not refetch when only the language changes.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const params = useParams<{ runId: string }>();
  const runId = params?.runId ?? "";
  const gate = useRequireBackend("mentor");
  const blocked = gate.blocked;

  const [run, setRun] = useState<RunRecord | null>(null);
  const [transcript, setTranscript] = useState<RunTranscript | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (blocked || !runId) {
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
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : tRef.current("run.loadError"));
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blocked, runId]);

  if (gate.blocked) {
    return <AuthGate gate={gate} />;
  }

  if (!loaded) {
    return (
      <AppShell>
        <p className="text-sm text-[var(--color-ink-soft)]">{t("run.loading")}</p>
      </AppShell>
    );
  }

  if (!run) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-soft)]">
          <h1 className="display-sm">{t("run.notFound")}</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-ink-soft)]">
            {error ?? t("run.notFoundBody")}
          </p>
          <Link href="/mentor" className="btn-editorial btn-editorial--quiet mt-5 inline-flex">
            {t("run.backDashboard")}
          </Link>
        </div>
      </AppShell>
    );
  }

  const scenarioMessages =
    transcript?.messages.filter((message) => message.role === "scenario") ?? [];

  return (
    <AppShell>
      <div className="space-y-6">
        <Reveal className="accent-edge rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <Link
            href={`/mentor/trainee/${run.userId}`}
            className="link-editorial text-xs font-medium text-[var(--color-primary)]"
          >
            {t("run.backTo", { name: run.userDisplayName })}
          </Link>
          <h1 className="display-md mt-2 max-w-3xl">{run.scenarioTitle}</h1>
          <p className="mt-2 max-w-3xl text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
            {run.scenarioSummary}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MetricChip label={t("run.trainee")} value={run.userDisplayName} tone="slate" />
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

        {/* The same deck the trainee saw — no mentor-only variant to drift. */}
        <FeedbackReportView report={run.report} scenarioMessages={scenarioMessages} />

        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
          <h2 className="display-sm">{t("run.transcript")}</h2>
          {transcript ? (
            <div className="mt-4">
              {/* Read-only: onSpeak is omitted, so no playback controls render. */}
              <ChatMessageList messages={transcript.messages} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
              {t("run.noTranscript")}
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
