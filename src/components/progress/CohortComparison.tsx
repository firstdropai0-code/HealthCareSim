"use client";

import { InfoCard, StepProgress } from "@/components/common/VisualCards";
import { categoryLabel, useT, type Translator } from "@/lib/i18n/strings";
import type {
  CohortBucketDescriptor,
  CohortComparison as Comparison,
} from "@/lib/progress/cohortStats";

/** Names the peer group in the reader's language: this case, a track, or a tier. */
function bucketName(t: Translator, bucket: CohortBucketDescriptor): string {
  const level = t(`difficulty.${bucket.difficulty}`).toLowerCase();

  if (bucket.kind === "library-case") {
    return t("cohort.bucket.case");
  }

  if (bucket.kind === "category-difficulty" && bucket.category) {
    return t("cohort.bucket.track", { track: categoryLabel(t, bucket.category), level });
  }

  return t("cohort.bucket.level", { level });
}

/**
 * Below the thresholds this shows no rank and no percentile — never "1st of 2".
 * The progress framing is honest about why, and doubles as a nudge.
 */
export function CohortComparison({ comparison }: { comparison: Comparison }) {
  const t = useT();

  if (!comparison.ready) {
    return (
      <InfoCard label={t("cohort.label")} title={t("cohort.notOpen")} tone="slate">
        <p className="text-[0.9375rem] leading-6">
          {t("cohort.notOpenBody", {
            trainees: comparison.requiredTrainees,
            runs: comparison.requiredRuns,
          })}
        </p>
        <div className="mt-4 grid gap-3">
          <StepProgress
            current={Math.min(comparison.traineeCount, comparison.requiredTrainees)}
            total={comparison.requiredTrainees}
            label={t("cohort.trainees")}
            variant="bare"
          />
          <StepProgress
            current={Math.min(comparison.runCount, comparison.requiredRuns)}
            total={comparison.requiredRuns}
            label={t("cohort.casesCompleted")}
            variant="bare"
          />
        </div>
      </InfoCard>
    );
  }

  const { yourScore, yourPercentile } = comparison;

  return (
    <InfoCard
      label={t("cohort.label")}
      title={t("cohort.comparedOn", { bucket: bucketName(t, comparison.bucket) })}
      tone="emerald"
    >
      <p className="text-[0.9375rem] leading-6">
        {t.plural("cohort.summary", comparison.runCount, {
          mean: comparison.mean.toFixed(1),
          trainees: comparison.traineeCount,
        })}
      </p>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {[
          [t("cohort.lower"), comparison.p25],
          [t("cohort.middle"), comparison.p50],
          [t("cohort.upper"), comparison.p75],
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
          {t.rich(yourPercentile !== null ? "cohort.yourLatestAbove" : "cohort.yourLatest", {
            score: <span className="font-semibold text-[var(--color-ink)]">{yourScore}/10</span>,
            pct: yourPercentile ?? "",
          })}
        </p>
      ) : (
        <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-[0.9375rem] leading-6 text-[var(--color-ink-soft)]">
          {t("cohort.completeOne")}
        </p>
      )}
    </InfoCard>
  );
}
