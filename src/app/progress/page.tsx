"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { InfoCard, MetricChip } from "@/components/common/VisualCards";
import { AppShell } from "@/components/layout/AppShell";
import { Reveal } from "@/components/motion/Reveal";
import { AverageScoreCard } from "@/components/progress/AverageScoreCard";
import { CohortComparison } from "@/components/progress/CohortComparison";
import { ScoreTrendLine } from "@/components/progress/ScoreTrendLine";
import { SkillTree } from "@/components/progress/SkillTree";
import { SubscoreRadar } from "@/components/progress/SubscoreRadar";
import { useRequireBackend } from "@/lib/firebase/useAuth";
import { computeCohort, selectBucket } from "@/lib/progress/cohortStats";
import { computeProgress } from "@/lib/progress/progressModel";
import { computeSkillTree } from "@/lib/progress/skillTree";
import { listGroupCases } from "@/lib/cases/caseRepository";
import { listGroupRunStats, listMyRuns } from "@/lib/runs/runRepository";
import { difficultyMeta } from "@/lib/scenarios/scenarioLibrary";
import { createInitialSimulationState } from "@/lib/simulation/simulationEngine";
import {
  clearSimulationState,
  saveSimulationState,
} from "@/lib/storage/localSimulationStorage";
import type { AssignedCase } from "@/types/assignedCase";
import { subscoreLabels } from "@/types/feedback";
import type { RunStat, RunSummary } from "@/types/run";

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function ProgressPage() {
  const router = useRouter();
  const gate = useRequireBackend("trainee");
  const profile = gate.blocked ? null : gate.profile;
  const uid = profile?.uid ?? null;
  const groupId = profile?.groupId ?? null;

  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [stats, setStats] = useState<RunStat[]>([]);
  const [cases, setCases] = useState<AssignedCase[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [myRuns, groupStats, groupCases] = await Promise.all([
          listMyRuns(uid),
          groupId ? listGroupRunStats(groupId) : Promise.resolve([]),
          groupId ? listGroupCases(groupId) : Promise.resolve([]),
        ]);

        if (!cancelled) {
          setRuns(myRuns);
          setStats(groupStats);
          setCases(groupCases);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load your progress.");
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
  }, [groupId, uid]);

  // Everything measured runs off scored runs only. Fallback reports still
  // appear in the session list below, but they move no average and open no node.
  const scoredRuns = useMemo(() => runs.filter((run) => run.countsTowardStats), [runs]);
  const progress = useMemo(() => computeProgress(scoredRuns), [scoredRuns]);
  const tree = useMemo(() => computeSkillTree(scoredRuns, cases), [cases, scoredRuns]);

  const cohort = useMemo(() => {
    const latest = scoredRuns[0];
    if (!latest) {
      return null;
    }

    const bucket = selectBucket(stats, {
      libraryId: latest.libraryId,
      category: latest.category,
      difficulty: latest.difficulty,
    });

    return computeCohort(bucket, latest.score);
  }, [scoredRuns, stats]);

  if (gate.blocked) {
    return <AuthGate gate={gate} />;
  }

  // Same path as starting from /cases: a fresh run id per attempt, so a retry
  // becomes its own record rather than overwriting the score being improved on.
  function handleStartCase(entry: AssignedCase) {
    clearSimulationState();
    saveSimulationState(createInitialSimulationState(entry.scenario));
    router.push("/simulation");
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <Reveal className="accent-edge rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <p className="eyebrow text-[var(--color-primary)]">My progress</p>
          <h1 className="display-md mt-2">Where your communication is going.</h1>
          <p className="mt-2 max-w-2xl text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
            Built from your scored cases. Practice runs that could not be scored are listed but
            do not move these numbers.
          </p>
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

        {!groupId ? (
          <div className="rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-warning)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm">
            You are not in a group yet, so your cases are not being saved.{" "}
            <Link href="/join" className="font-semibold underline">
              Enter a join code
            </Link>
            .
          </div>
        ) : null}

        {!loaded ? (
          <p className="text-sm text-[var(--color-ink-soft)]">Loading your progress...</p>
        ) : runs.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] p-8 text-center">
            <p className="text-sm font-medium text-[var(--color-ink)]">No cases yet.</p>
            <p className="mt-1.5 text-xs leading-5 text-[var(--color-ink-soft)]">
              Your first scored case starts the skill tree.
            </p>
            <Link href="/cases" className="btn-editorial btn-editorial--accent mt-5 inline-flex">
              Start a case
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_300px] lg:items-start">
              <AverageScoreCard
                average={progress.averageScore}
                emptyHint="Your cases ran, but none could be scored. Finish one while the simulator is available to start tracking."
              />

              <InfoCard label="Over time" title="Score trend" tone="slate">
                <ScoreTrendLine series={progress.scoreSeries} />
              </InfoCard>

              <InfoCard label="Profile" title="Skill balance" tone="emerald">
                <SubscoreRadar dimensions={progress.dimensions} />
              </InfoCard>
            </div>

            {cohort ? <CohortComparison comparison={cohort} /> : null}

            <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
              <h2 className="display-sm">Skill tree</h2>
              <p className="mt-1.5 text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
                The tracks your mentor has set cases in, at three levels.
              </p>
              <div className="mt-5">
                <SkillTree nodes={tree} cases={cases} onStart={handleStartCase} />
              </div>
            </section>

            <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
              <h2 className="display-sm">Recent sessions</h2>
              <ul className="mt-4 divide-y divide-[var(--color-border)]">
                {runs.slice(0, 12).map((run) => (
                  <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--color-ink)]">
                        {run.scenarioTitle}
                      </p>
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
