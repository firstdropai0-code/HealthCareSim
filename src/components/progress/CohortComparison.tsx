"use client";

import { InfoCard, StepProgress } from "@/components/common/VisualCards";
import type { CohortComparison as Comparison } from "@/lib/progress/cohortStats";

/**
 * Below the thresholds this shows no rank and no percentile — never "1st of 2".
 * The progress framing is honest about why, and doubles as a nudge.
 */
export function CohortComparison({ comparison }: { comparison: Comparison }) {
  if (!comparison.ready) {
    return (
      <InfoCard label="Your group" title="Comparison not open yet" tone="slate">
        <p className="text-[0.9375rem] leading-6">
          Group comparison opens once {comparison.requiredTrainees} trainees have completed{" "}
          {comparison.requiredRuns} cases at this level. Comparing across a smaller group would
          say more about who happened to practise than about how anyone is doing.
        </p>
        <div className="mt-4 grid gap-3">
          <StepProgress
            current={Math.min(comparison.traineeCount, comparison.requiredTrainees)}
            total={comparison.requiredTrainees}
            label="Trainees"
            variant="bare"
          />
          <StepProgress
            current={Math.min(comparison.runCount, comparison.requiredRuns)}
            total={comparison.requiredRuns}
            label="Cases completed"
            variant="bare"
          />
        </div>
      </InfoCard>
    );
  }

  const { yourScore, yourPercentile } = comparison;

  return (
    <InfoCard label="Your group" title={`Compared on ${comparison.bucketLabel}`} tone="emerald">
      <p className="text-[0.9375rem] leading-6">
        Group average {comparison.mean.toFixed(1)} across {comparison.runCount}{" "}
        {comparison.runCount === 1 ? "case" : "cases"} from {comparison.traineeCount} trainees.
        Names are never shown, in either direction.
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          ["Lower quarter", comparison.p25],
          ["Middle", comparison.p50],
          ["Upper quarter", comparison.p75],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-2 py-2"
          >
            <dt className="eyebrow eyebrow-tight text-[var(--color-ink-soft)]">{label}</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-[var(--color-ink)]">
              {Number(value).toFixed(1)}
            </dd>
          </div>
        ))}
      </dl>

      {yourScore !== null ? (
        <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-[0.9375rem] leading-6">
          Your latest score on this is{" "}
          <span className="font-semibold text-[var(--color-ink)]">{yourScore}/10</span>
          {yourPercentile !== null
            ? `, above ${yourPercentile}% of the group's runs at this level.`
            : "."}
        </p>
      ) : (
        <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-[0.9375rem] leading-6 text-[var(--color-ink-soft)]">
          Complete a case at this level to see where you sit.
        </p>
      )}
    </InfoCard>
  );
}
