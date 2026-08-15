"use client";

import { scoreBand, scoreBandMeta, type ScoreBand } from "@/lib/progress/progressModel";

const order: ScoreBand[] = ["needsFocus", "developing", "strong"];

/**
 * Replaces a 10-bucket histogram, which needs far more than a demo's worth of
 * runs before its shape means anything — at seven cases it is three lonely
 * bars. Three bands stay readable at any sample size and map to the same words
 * used on every individual report.
 */
export function ScoreBands({ scores }: { scores: number[] }) {
  if (scores.length === 0) {
    return (
      <p className="text-[0.9375rem] leading-7 text-[var(--color-ink-soft)]">
        No scored cases in this group yet.
      </p>
    );
  }

  const counts = order.map((band) => ({
    band,
    meta: scoreBandMeta[band],
    count: scores.filter((score) => scoreBand(score) === band).length,
  }));

  return (
    <div>
      {/* One proportional bar, so the split is legible before any number is read. */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
        {counts.map(({ band, meta, count }) =>
          count > 0 ? (
            <div
              key={band}
              className={meta.fill}
              style={{ width: `${(count / scores.length) * 100}%` }}
            />
          ) : null,
        )}
      </div>

      <dl className="mt-4 grid gap-2.5">
        {counts.map(({ band, meta, count }) => (
          <div key={band} className="flex items-baseline justify-between gap-3">
            <dt className="flex items-center gap-2">
              <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${meta.fill}`} />
              <span className={`text-[0.9375rem] ${meta.ink}`}>{meta.label}</span>
            </dt>
            <dd className="text-[0.9375rem] font-semibold tabular-nums text-[var(--color-ink)]">
              {count}
              <span className="font-normal text-[var(--color-ink-soft)]">
                {" "}
                / {scores.length}
              </span>
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-xs leading-5 text-[var(--color-ink-soft)]">
        A case counts as cleared at 6 or above.
      </p>
    </div>
  );
}
