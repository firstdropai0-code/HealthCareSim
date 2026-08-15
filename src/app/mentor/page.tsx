"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { InfoCard, MetricChip } from "@/components/common/VisualCards";
import { AppShell } from "@/components/layout/AppShell";
import { Reveal } from "@/components/motion/Reveal";
import { GroupHeadline } from "@/components/progress/GroupHeadline";
import { ScoreBands } from "@/components/progress/ScoreBands";
import { useRequireBackend } from "@/lib/firebase/useAuth";
import { listMembers } from "@/lib/groups/groupRepository";
import {
  computeProgress,
  scoreBand,
  scoreBandMeta,
} from "@/lib/progress/progressModel";
import { CLEAR_SCORE } from "@/lib/progress/skillTree";
import { listGroupRuns } from "@/lib/runs/runRepository";
import { difficultyOrder, difficultyMeta } from "@/lib/scenarios/scenarioLibrary";
import {
  subscoreDimensions,
  subscoreLabels,
  type SubscoreDimension,
} from "@/types/feedback";
import type { GroupMember } from "@/types/group";
import type { RunSummary } from "@/types/run";

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function mean(values: number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((total, value) => total + value, 0) / values.length;
}

export default function MentorDashboardPage() {
  const gate = useRequireBackend("mentor");
  const profile = gate.blocked ? null : gate.profile;
  const groupId = profile?.groupId ?? null;
  const mentorId = profile?.uid ?? null;

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [queryLoaded, setQueryLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived: with no group there is nothing to fetch.
  const loaded = groupId ? queryLoaded : true;

  useEffect(() => {
    if (!groupId || !mentorId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        // One bounded query for the whole group, aggregated client-side. No
        // Cloud Functions in this build, so there are no precomputed rollups.
        const [nextMembers, nextRuns] = await Promise.all([
          listMembers(groupId),
          listGroupRuns(mentorId),
        ]);

        if (!cancelled) {
          setMembers(nextMembers);
          setRuns(nextRuns);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load your group.");
        }
      } finally {
        if (!cancelled) {
          setQueryLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groupId, mentorId]);

  const rows = useMemo(() => {
    return (
      members
        .map((member) => {
          const theirRuns = runs.filter((run) => run.userId === member.uid);
          const progress = computeProgress(theirRuns);
          const rated = progress.dimensions.filter((entry) => entry.mastery !== null);
          const weakest = [...rated].sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))[0] ?? null;

          return { member, runCount: theirRuns.length, progress, weakest };
        })
        // Lowest average first. Sorting by run count put the most active trainee
        // on top, which is rarely the one who needs the conversation.
        .sort((a, b) => {
          const aScore = a.progress.averageScore;
          const bScore = b.progress.averageScore;
          if (aScore === null) return 1;
          if (bScore === null) return -1;
          return aScore - bScore;
        })
    );
  }, [members, runs]);

  const needingAttention = useMemo(
    () =>
      rows
        .filter((row) => row.progress.averageScore !== null && row.progress.averageScore < CLEAR_SCORE)
        .map((row) => row.member.displayName || row.member.email),
    [rows],
  );

  const groupScores = useMemo(
    () => runs.map((run) => run.score).filter((score): score is number => score !== null),
    [runs],
  );

  const dimensionMeans = useMemo(
    () =>
      subscoreDimensions.map((dimension) => ({
        dimension,
        value: mean(
          runs
            .map((run) => run.subscores?.[dimension])
            .filter((value): value is number => typeof value === "number"),
        ),
      })),
    [runs],
  );

  const weakestDimension = useMemo(() => {
    const rated = dimensionMeans.filter(
      (entry): entry is { dimension: SubscoreDimension; value: number } => entry.value !== null,
    );

    return rated.length === 0
      ? null
      : [...rated].sort((a, b) => a.value - b.value)[0].dimension;
  }, [dimensionMeans]);

  const groupAverage = useMemo(() => mean(groupScores), [groupScores]);

  const tierCounts = useMemo(
    () =>
      difficultyOrder.map((difficulty) => ({
        difficulty,
        count: runs.filter((run) => run.difficulty === difficulty).length,
      })),
    [runs],
  );

  if (gate.blocked) {
    return <AuthGate gate={gate} />;
  }

  if (!groupId) {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-soft)]">
          <p className="eyebrow text-[var(--color-primary)]">Dashboard</p>
          <h1 className="display-md mt-2">Create your group first.</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-ink-soft)]">
            The dashboard fills in once trainees join and start completing cases.
          </p>
          <Link href="/mentor/group" className="btn-editorial btn-editorial--accent mt-5 inline-flex">
            Set up my group
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <Reveal className="accent-edge rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
          <p className="eyebrow text-[var(--color-primary)]">Dashboard</p>
          <h1 className="display-md mt-2">How your group is doing.</h1>
          <p className="mt-2 max-w-2xl text-[0.9375rem] leading-6 text-[var(--color-ink-muted)]">
            Scored cases only. Runs that could not be scored are excluded from every figure here.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MetricChip label="Trainees" value={String(members.length)} tone="emerald" />
            <MetricChip label="Scored cases" value={String(runs.length)} tone="blue" />
            {groupScores.length > 0 ? (
              <MetricChip
                label="Group average"
                value={`${(mean(groupScores) ?? 0).toFixed(1)} / 10`}
                tone="slate"
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
          <p className="text-sm text-[var(--color-ink-soft)]">Loading your group...</p>
        ) : (
          <>
            <GroupHeadline
              average={groupAverage}
              runCount={groupScores.length}
              traineeCount={members.length}
              weakestDimension={weakestDimension}
              needingAttention={needingAttention}
            />

            <div className="grid gap-4 lg:grid-cols-3">
              <InfoCard label="Distribution" title="How cases are landing" tone="slate">
                <ScoreBands scores={groupScores} />
              </InfoCard>

              <InfoCard label="By dimension" title="Group averages" tone="emerald">
                <dl className="grid gap-3">
                  {dimensionMeans.map((entry) => {
                    const isWeakest = entry.dimension === weakestDimension;

                    return (
                      <div key={entry.dimension}>
                        <div className="flex items-baseline justify-between gap-3">
                          <dt
                            className={`text-[0.9375rem] ${
                              isWeakest
                                ? "font-semibold text-[var(--color-ink)]"
                                : "text-[var(--color-ink-muted)]"
                            }`}
                          >
                            {subscoreLabels[entry.dimension]}
                            {isWeakest ? (
                              <span className="eyebrow eyebrow-tight ml-2 text-[var(--color-danger)]">
                                Focus here
                              </span>
                            ) : null}
                          </dt>
                          <dd className="text-[0.9375rem] font-semibold tabular-nums text-[var(--color-ink)]">
                            {entry.value === null ? "—" : entry.value.toFixed(1)}
                          </dd>
                        </div>
                        {/* A bar makes the weakest dimension visible without
                            comparing five numbers to each other. */}
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                          <div
                            className={`h-full rounded-full ${
                              entry.value === null
                                ? ""
                                : scoreBandMeta[scoreBand(entry.value)].fill
                            }`}
                            style={{ width: `${((entry.value ?? 0) / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </dl>
              </InfoCard>

              <InfoCard label="Coverage" title="Cases by level" tone="blue">
                <dl className="grid gap-2">
                  {tierCounts.map((entry) => (
                    <div key={entry.difficulty} className="flex items-baseline justify-between gap-3">
                      <dt className="text-[0.9375rem] text-[var(--color-ink-muted)]">
                        {difficultyMeta[entry.difficulty].label}
                      </dt>
                      <dd className="text-sm font-semibold tabular-nums text-[var(--color-ink)]">
                        {entry.count}
                      </dd>
                    </div>
                  ))}
                </dl>
              </InfoCard>
            </div>

            <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="display-sm">Trainees</h2>
                <Link
                  href="/mentor/group"
                  className="link-editorial text-sm font-medium text-[var(--color-primary)]"
                >
                  Manage group
                </Link>
              </div>

              {rows.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--color-ink-soft)]">
                  No trainees yet. Share your join code to get started.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        {["Trainee", "Cases", "Average", "Weakest", "Last active"].map((heading) => (
                          <th
                            key={heading}
                            scope="col"
                            className="eyebrow eyebrow-tight py-2 pr-3 text-[var(--color-ink-soft)]"
                          >
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ member, runCount, progress, weakest }) => (
                        <tr key={member.uid} className="border-b border-[var(--color-border)]">
                          <td className="py-3 pr-3">
                            <Link
                              href={`/mentor/trainee/${member.uid}`}
                              className="link-editorial text-sm font-medium text-[var(--color-ink)]"
                            >
                              {member.displayName || member.email}
                            </Link>
                          </td>
                          <td className="py-3 pr-3 text-sm tabular-nums text-[var(--color-ink-muted)]">
                            {runCount}
                          </td>
                          <td className="py-3 pr-3">
                            {progress.averageScore === null ? (
                              <span className="text-[0.9375rem] text-[var(--color-ink-soft)]">—</span>
                            ) : (
                              <span className="flex items-baseline gap-2">
                                <span className="text-[0.9375rem] font-semibold tabular-nums text-[var(--color-ink)]">
                                  {progress.averageScore.toFixed(1)}
                                </span>
                                <span
                                  className={`eyebrow eyebrow-tight ${
                                    scoreBandMeta[scoreBand(progress.averageScore)].ink
                                  }`}
                                >
                                  {scoreBandMeta[scoreBand(progress.averageScore)].label}
                                </span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-3 text-[0.9375rem] text-[var(--color-ink-muted)]">
                            {weakest ? subscoreLabels[weakest.dimension] : "—"}
                          </td>
                          <td className="py-3 pr-3 text-sm text-[var(--color-ink-muted)]">
                            {progress.lastActive ? formatDate(progress.lastActive) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
