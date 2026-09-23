"use client";

import { categoryLabel, useT } from "@/lib/i18n/strings";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
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
import type { AssignedCase } from "@/types/assignedCase";
import type { RunSummary } from "@/types/run";
import { useLanguage } from "@/lib/i18n/languageStore";
import { languageDateLocale, type AppLanguage } from "@/types/language";

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

export default function MentorTraineePage() {
  const params = useParams<{ uid: string }>();
  const uid = params?.uid ?? "";
  const t = useT();
  const language = useLanguage();
  // For the load effect, which must not refetch when only the language changes.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  });
  const gate = useRequireBackend("mentor");
  const profile = gate.blocked ? null : gate.profile;
  const mentorId = profile?.uid ?? null;
  const groupId = profile?.groupId ?? null;

  const [cases, setCases] = useState<AssignedCase[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  // Which group the state below belongs to, so a group switch shows a loading
  // state rather than the previous group's runs under this trainee's name.
  const [loadedGroupId, setLoadedGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loaded = groupId ? loadedGroupId === groupId : true;

  useEffect(() => {
    if (!mentorId || !uid || !groupId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const [nextRuns, nextCases] = await Promise.all([
          listTraineeRuns(mentorId, uid, groupId),
          listGroupCases(groupId),
        ]);
        if (!cancelled) {
          setRuns(nextRuns);
          setCases(nextCases);
          // Cleared here rather than up front: a failure on the previous group
          // must not stay on screen once a different one has loaded cleanly.
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : tRef.current("trainee.loadError"));
        }
      } finally {
        if (!cancelled) {
          setLoadedGroupId(groupId);
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

  const traineeName = loaded
    ? (runs[0]?.userDisplayName ?? t("trainee.fallbackName"))
    : t("trainee.fallbackName");

  return (
    <AppShell>
      <div className="space-y-6">
        <Reveal className="accent-edge rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <Link href="/mentor" className="link-editorial text-xs font-medium text-[var(--color-primary)]">
            {t("trainee.back")}
          </Link>
          <h1 className="display-md mt-2">{traineeName}</h1>
          {/* Gated like the body below: these sit above the loading branch, and
              a group switch would otherwise leave the old group's tallies here. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MetricChip
              label={t("trainee.scoredCases")}
              value={loaded ? String(scoredRuns.length) : "—"}
              tone="emerald"
            />
            {loaded && progress.lastActive ? (
              <MetricChip
                label={t("trainee.lastActive")}
                value={formatDate(progress.lastActive, language)}
                tone="slate"
              />
            ) : null}
            {loaded && progress.weakest ? (
              <MetricChip
                label={t("trainee.focus")}
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

        {!loaded ? (
          <p className="text-sm text-[var(--color-ink-soft)]">{t("common.loading")}</p>
        ) : runs.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] p-8 text-center text-sm text-[var(--color-ink-soft)]">
            {t("trainee.none")}
          </p>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_300px] lg:items-start">
              <AverageScoreCard
                average={progress.averageScore}
                emptyHint={t("trainee.unscored")}
              />
              <InfoCard label={t("trainee.overTime")} title={t("trainee.scoreTrend")} tone="slate">
                <ScoreTrendLine series={progress.scoreSeries} />
              </InfoCard>
              <InfoCard label={t("trainee.profile")} title={t("trainee.skillBalance")} tone="emerald">
                <SubscoreRadar dimensions={progress.dimensions} />
              </InfoCard>
            </div>

            <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
              <h2 className="display-sm">{t("trainee.skillTree")}</h2>
              <div className="mt-5">
                <SkillTree nodes={tree} />
              </div>
            </section>

            <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
              <h2 className="display-sm">{t("trainee.sessions")}</h2>
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
                        {run.category ? `${categoryLabel(t, run.category)} · ` : ""}
                        {t(`difficulty.${run.difficulty}`)} · {formatDate(run.completedAt, language)} ·{" "}
                        {t.plural("common.turns", run.turnCount)}
                      </p>
                    </div>
                    {run.score === null ? (
                      <MetricChip label={t("trainee.notScored")} tone="amber" />
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
