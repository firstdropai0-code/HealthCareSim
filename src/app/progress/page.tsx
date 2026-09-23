"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { useLanguage } from "@/lib/i18n/languageStore";
import { categoryLabel, useT } from "@/lib/i18n/strings";
import { computeCohort, selectBucket } from "@/lib/progress/cohortStats";
import { computeProgress } from "@/lib/progress/progressModel";
import { computeSkillTree } from "@/lib/progress/skillTree";
import { listGroupCases } from "@/lib/cases/caseRepository";
import { listGroupRunStats, listMyRuns } from "@/lib/runs/runRepository";
import { createInitialSimulationState } from "@/lib/simulation/simulationEngine";
import {
  clearSimulationState,
  saveSimulationState,
} from "@/lib/storage/localSimulationStorage";
import type { AssignedCase } from "@/types/assignedCase";
import type { RunStat, RunSummary } from "@/types/run";
import { languageDateLocale, type AppLanguage } from "@/types/language";

function formatDate(iso: string, language: AppLanguage): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(languageDateLocale[language], { day: "numeric", month: "short" });
}

export default function ProgressPage() {
  const router = useRouter();
  const gate = useRequireBackend("trainee");
  const profile = gate.blocked ? null : gate.profile;
  const uid = profile?.uid ?? null;
  const groupId = profile?.groupId ?? null;
  const t = useT();
  const language = useLanguage();
  // For the load effect, which must not refetch when only the language changes.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });

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
          setError(err instanceof Error ? err.message : tRef.current("progress.loadError"));
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
  /*
   * Only cases in the language being read, the same rule the cases page
   * applies. The tree's cells can start a run, so leaving the other language in
   * here offered a Hindi reader an English case one tap away -- and inflated
   * every "cases to try" count with cases they are never shown anywhere else.
   * Runs are not filtered: what a trainee has already done is still their
   * history, whichever language they did it in.
   */
  const casesInLanguage = useMemo(
    () => cases.filter((entry) => (entry.scenario.language ?? "en") === language),
    [cases, language],
  );
  const tree = useMemo(
    () => computeSkillTree(scoredRuns, casesInLanguage),
    [casesInLanguage, scoredRuns],
  );

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
          <p className="eyebrow text-[var(--color-primary)]">{t("progress.title")}</p>
          <h1 className="display-md mt-2">{t("progress.subtitle")}</h1>
          <p className="mt-2 max-w-2xl text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
            {t("progress.intro")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MetricChip label={t("progress.scoredCases")} value={String(scoredRuns.length)} tone="emerald" />
            {progress.lastActive ? (
              <MetricChip
                label={t("progress.lastActive")}
                value={formatDate(progress.lastActive, language)}
                tone="slate"
              />
            ) : null}
            {progress.weakest ? (
              <MetricChip
                label={t("progress.focus")}
                value={t(`subscore.${progress.weakest.dimension}`)}
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
            {t("progress.notSaved")}{" "}
            <Link href="/join" className="font-semibold underline">
              {t("progress.enterCode")}
            </Link>
            .
          </div>
        ) : null}

        {!loaded ? (
          <p className="text-sm text-[var(--color-ink-soft)]">{t("progress.loading")}</p>
        ) : runs.length === 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] p-8 text-center">
            <p className="text-sm font-medium text-[var(--color-ink)]">{t("progress.emptyTitle")}</p>
            <p className="mt-1.5 text-xs leading-5 text-[var(--color-ink-soft)]">
              {t("progress.firstStarts")}
            </p>
            <Link href="/cases" className="btn-editorial btn-editorial--accent mt-5 inline-flex">
              {t("progress.startCase")}
            </Link>
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_300px] lg:items-start">
              <AverageScoreCard
                average={progress.averageScore}
                emptyHint={t("progress.unscored")}
              />

              <InfoCard label={t("progress.overTime")} title={t("progress.scoreTrend")} tone="slate">
                <ScoreTrendLine series={progress.scoreSeries} />
              </InfoCard>

              <InfoCard label={t("progress.profile")} title={t("progress.skillBalance")} tone="emerald">
                <SubscoreRadar dimensions={progress.dimensions} />
              </InfoCard>
            </div>

            {cohort ? <CohortComparison comparison={cohort} /> : null}

            <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
              <h2 className="display-sm">{t("progress.skillTree")}</h2>
              <p className="mt-1.5 text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
                {t("progress.treeIntro")}
              </p>
              <div className="mt-5">
                <SkillTree nodes={tree} cases={casesInLanguage} onStart={handleStartCase} />
              </div>
            </section>

            <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
              <h2 className="display-sm">{t("progress.recentSessions")}</h2>
              <ul className="mt-4 divide-y divide-[var(--color-border)]">
                {runs.slice(0, 12).map((run) => (
                  <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--color-ink)]">
                        {run.scenarioTitle}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                        {run.category ? `${categoryLabel(t, run.category)} · ` : ""}
                        {t(`difficulty.${run.difficulty}`)} · {formatDate(run.completedAt, language)} ·{" "}
                        {t.plural("common.turns", run.turnCount)}
                      </p>
                    </div>
                    {run.score === null ? (
                      <MetricChip label={t("progress.notScored")} tone="amber" />
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
