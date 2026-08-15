"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { MetricChip } from "@/components/common/VisualCards";
import { FeedbackReportView } from "@/components/feedback/FeedbackReportView";
import { AppShell } from "@/components/layout/AppShell";
import { Reveal } from "@/components/motion/Reveal";
import { ChatMessageList } from "@/components/simulation/ChatMessageList";
import { useRequireBackend } from "@/lib/firebase/useAuth";
import { getRun, getRunTranscript } from "@/lib/runs/runRepository";
import { difficultyMeta } from "@/lib/scenarios/scenarioLibrary";
import type { RunRecord, RunTranscript } from "@/types/run";

export default function MentorRunPage() {
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
          setError(err instanceof Error ? err.message : "Could not load that session.");
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
        <p className="text-sm text-[var(--color-ink-soft)]">Loading session...</p>
      </AppShell>
    );
  }

  if (!run) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-soft)]">
          <h1 className="display-sm">Session not found</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-ink-soft)]">
            {error ?? "It may have been removed, or it belongs to another group."}
          </p>
          <Link href="/mentor" className="btn-editorial btn-editorial--quiet mt-5 inline-flex">
            Back to dashboard
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
            &larr; Back to {run.userDisplayName}
          </Link>
          <h1 className="display-md mt-2 max-w-3xl">{run.scenarioTitle}</h1>
          <p className="mt-2 max-w-3xl text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
            {run.scenarioSummary}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MetricChip label="Trainee" value={run.userDisplayName} tone="slate" />
            <MetricChip label="Level" value={difficultyMeta[run.difficulty].label} tone="blue" />
            {run.category ? <MetricChip label="Track" value={run.category} tone="indigo" /> : null}
            <MetricChip
              label="Ended in"
              value={`${run.turnCount} ${run.turnCount === 1 ? "turn" : "turns"}`}
              tone="slate"
            />
            {run.score === null ? (
              <MetricChip label="Not scored" tone="amber" />
            ) : (
              <MetricChip label="Score" value={`${run.score} / 10`} tone="emerald" />
            )}
          </div>
        </Reveal>

        {/* The same deck the trainee saw — no mentor-only variant to drift. */}
        <FeedbackReportView report={run.report} scenarioMessages={scenarioMessages} />

        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
          <h2 className="display-sm">Full transcript</h2>
          {transcript ? (
            <div className="mt-4">
              {/* Read-only: onSpeak is omitted, so no playback controls render. */}
              <ChatMessageList messages={transcript.messages} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
              The transcript for this session is not available.
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
