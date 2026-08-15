"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { InfoCard, MetricChip } from "@/components/common/VisualCards";
import { AppShell } from "@/components/layout/AppShell";
import { Reveal } from "@/components/motion/Reveal";
import { AverageScoreCard } from "@/components/progress/AverageScoreCard";
import { ScoreTrendLine } from "@/components/progress/ScoreTrendLine";
import { SkillTree } from "@/components/progress/SkillTree";
import { SubscoreRadar } from "@/components/progress/SubscoreRadar";
import { useRequireBackend } from "@/lib/firebase/useAuth";
import { computeProgress } from "@/lib/progress/progressModel";
import { computeSkillTree } from "@/lib/progress/skillTree";
import { listGroupCases } from "@/lib/cases/caseRepository";
import { listTraineeRuns } from "@/lib/runs/runRepository";
import { difficultyMeta } from "@/lib/scenarios/scenarioLibrary";
import type { AssignedCase } from "@/types/assignedCase";
import { subscoreLabels } from "@/types/feedback";
import type { RunSummary } from "@/types/run";

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function MentorTraineePage() {
  const params = useParams<{ uid: string }>();
  const uid = params?.uid ?? "";
  const gate = useRequireBackend("mentor");
  const profile = gate.blocked ? null : gate.profile;
  const mentorId = profile?.uid ?? null;
  const groupId = profile?.groupId ?? null;

  const [cases, setCases] = useState<AssignedCase[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mentorId || !uid) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [nextRuns, nextCases] = await Promise.all([
          listTraineeRuns(mentorId, uid),
          groupId ? listGroupCases(groupId) : Promise.resolve([]),
        ]);
        if (!cancelled) {
          setRuns(nextRuns);
          setCases(nextCases);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load that trainee.");
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
  }, [groupId, mentorId, uid]);

  const scoredRuns = useMemo(() => runs.filter((run) => run.countsTowardStats), [runs]);
  const progress = useMemo(() => computeProgress(scoredRuns), [scoredRuns]);
  const tree = useMemo(() => computeSkillTree(scoredRuns, cases), [cases, scoredRuns]);

  if (gate.blocked) {
    return <AuthGate gate={gate} />;
  }

  const traineeName = runs[0]?.userDisplayName ?? "Trainee";

  return (
    <AppShell>
      <div className="space-y-6">
        <Reveal className="accent-edge rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <Link href="/mentor" className="link-editorial text-xs font-medium text-[var(--color-primary)]">
            &larr; Back to dashboard
          </Link>
          <h1 className="display-md mt-2">{traineeName}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MetricChip label="Scored cases" value={String(scoredRuns.length)} tone="emerald" />
            {progress.lastActive ? (
              <MetricChip label="Last active" value={formatDate(progress.lastActive)} tone="slate" />
            ) : null}
            {progress.weakest ? (
              <MetricChip
                label="Focus"
                value={subscoreLabels[progress.weakest.dimension]}
                tone="amber"
              />
            ) : null}
          </div>
        </Reveal>

        {error ? (
          <div
            role="alert"
            className="rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-danger)] bg-[var(--color-danger-soft)] px-4 py-3 text-sm text-[var(--color-danger)]"
          >
            {error}
          </div>
        ) : null}

        {!loaded ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Loading...</p>
        ) : runs.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] p-8 text-center text-sm text-[var(--color-ink-soft)]">
            This trainee has not completed a case yet.
          </p>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_300px] lg:items-start">
              <AverageScoreCard
                average={progress.averageScore}
                emptyHint="This trainee has completed cases, but none could be scored."
              />
              <InfoCard label="Over time" title="Score trend" tone="slate">
                <ScoreTrendLine series={progress.scoreSeries} />
              </InfoCard>
              <InfoCard label="Profile" title="Skill balance" tone="emerald">
                <SubscoreRadar dimensions={progress.dimensions} />
              </InfoCard>
            </div>

            <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
              <h2 className="display-sm">Skill tree</h2>
              <div className="mt-5">
                <SkillTree nodes={tree} />
              </div>
            </section>

            <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
              <h2 className="display-sm">Sessions</h2>
              <ul className="mt-4 divide-y divide-[var(--color-border)]">
                {runs.map((run) => (
                  <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/mentor/run/${run.id}`}
                        className="link-editorial truncate text-sm font-medium text-[var(--color-ink)]"
                      >
                        {run.scenarioTitle}
                      </Link>
                      <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                        {run.category ? `${run.category} · ` : ""}
                        {difficultyMeta[run.difficulty].label} · {formatDate(run.completedAt)} ·{" "}
                        {run.turnCount} {run.turnCount === 1 ? "turn" : "turns"}
                      </p>
                    </div>
                    {run.score === null ? (
                      <MetricChip label="Not scored" tone="amber" />
                    ) : (
                      <p className="text-sm font-semibold tabular-nums text-[var(--color-ink)]">
                        {run.score}
                        <span className="font-normal text-[var(--color-ink-soft)]"> / 10</span>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
