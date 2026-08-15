"use client";

import { scoreBand, scoreBandMeta } from "@/lib/progress/progressModel";
import { subscoreLabels, type SubscoreDimension } from "@/types/feedback";

/**
 * States the conclusion instead of leaving the mentor to derive it. Reading
 * "2.6" and five dimension numbers to work out that empathy is the group's
 * problem is work the page should have already done.
 */
export function GroupHeadline({
  average,
  runCount,
  traineeCount,
  weakestDimension,
  needingAttention,
}: {
  average: number | null;
  runCount: number;
  traineeCount: number;
  weakestDimension: SubscoreDimension | null;
  /** Trainees whose mean sits below the clearing score. */
  needingAttention: string[];
}) {
  if (average === null || runCount === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] p-5">
        <p className="text-[0.9375rem] leading-7 text-[var(--color-ink-muted)]">
          No scored cases yet. Once your trainees complete cases, this is where the group&rsquo;s
          headline reading appears.
        </p>
      </div>
    );
  }

  const band = scoreBand(average);
  const meta = scoreBandMeta[band];

  return (
    <div className="rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-primary)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <p className="eyebrow text-[var(--color-ink-soft)]">The short version</p>

      <p className="mt-2 text-lg leading-8 text-[var(--color-ink)]">
        Across {runCount} scored {runCount === 1 ? "case" : "cases"}, your group averages{" "}
        <strong className="tabular-nums">{average.toFixed(1)}</strong> out of 10 &mdash;{" "}
        <strong className={meta.ink}>{meta.label.toLowerCase()}</strong>.
        {weakestDimension ? (
          <>
            {" "}
            The weakest skill across the group is{" "}
            <strong>{subscoreLabels[weakestDimension].toLowerCase()}</strong>.
          </>
        ) : null}
      </p>

      {needingAttention.length > 0 ? (
        <p className="mt-3 text-[0.9375rem] leading-7 text-[var(--color-ink-muted)]">
          {needingAttention.length === traineeCount ? "Every trainee" : `${needingAttention.length} of ${traineeCount} trainees`}{" "}
          {needingAttention.length === 1 ? "is" : "are"} averaging below 6, the score a case has to
          reach to count as cleared: {needingAttention.join(", ")}.
        </p>
      ) : (
        <p className="mt-3 text-[0.9375rem] leading-7 text-[var(--color-ink-muted)]">
          Every trainee is averaging at or above 6, the score a case has to reach to count as
          cleared.
        </p>
      )}
    </div>
  );
}
