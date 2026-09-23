"use client";

import { useT } from "@/lib/i18n/strings";
import { scoreBand, scoreBandMeta } from "@/lib/progress/progressModel";
import type { SubscoreDimension } from "@/types/feedback";

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
  const t = useT();

  if (average === null || runCount === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-canvas-soft)] p-5">
        <p className="text-[0.9375rem] leading-7 text-[var(--color-ink-muted)]">
          {t("headline.empty")}
        </p>
      </div>
    );
  }

  const band = scoreBand(average);
  const meta = scoreBandMeta[band];
  const everyone = needingAttention.length === traineeCount;

  return (
    <div className="rounded-[var(--radius-lg)] border border-l-4 border-[var(--color-border)] border-l-[var(--color-primary)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <p className="eyebrow text-[var(--color-ink-soft)]">{t("headline.eyebrow")}</p>

      <p className="mt-2 text-lg leading-8 text-[var(--color-ink)]">
        {t.richPlural("headline.average", runCount, {
          avg: <strong className="tabular-nums">{average.toFixed(1)}</strong>,
          band: <strong className={meta.ink}>{t(`band.${band}`).toLowerCase()}</strong>,
        })}
        {weakestDimension ? (
          <>
            {" "}
            {t.rich("headline.weakest", {
              skill: <strong>{t(`subscore.${weakestDimension}`).toLowerCase()}</strong>,
            })}
          </>
        ) : null}
      </p>

      {needingAttention.length > 0 ? (
        <p className="mt-3 text-[0.9375rem] leading-7 text-[var(--color-ink-muted)]">
          {everyone
            ? t("headline.everyTrainee")
            : t("headline.someTrainees", { n: needingAttention.length, total: traineeCount })}{" "}
          {/* "Every trainee" takes a singular verb however many there are. */}
          {t.plural("headline.below", everyone ? 1 : needingAttention.length, {
            names: needingAttention.join(", "),
          })}
        </p>
      ) : (
        <p className="mt-3 text-[0.9375rem] leading-7 text-[var(--color-ink-muted)]">
          {t("headline.allClear")}
        </p>
      )}
    </div>
  );
}
