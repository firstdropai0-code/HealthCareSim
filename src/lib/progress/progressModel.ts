import { subscoreDimensions, type SubscoreDimension } from "@/types/feedback";
import type { RunSummary } from "@/types/run";

/** Mastery reads the last N runs, so improvement is visible rather than diluted. */
export const MASTERY_WINDOW = 5;
/** Trend compares the last N against the N before them. */
export const TREND_WINDOW = 3;

export type DimensionProgress = {
  dimension: SubscoreDimension;
  /** Mean of the most recent scores for this dimension; null with no data. */
  mastery: number | null;
  /** mean(last 3) - mean(previous 3). Null until there are 6 scored runs. */
  trend: number | null;
  sampleSize: number;
};

export type ProgressModel = {
  totalRuns: number;
  averageScore: number | null;
  /** Runs ordered oldest to newest, for the trend line. */
  scoreSeries: { completedAt: string; score: number }[];
  dimensions: DimensionProgress[];
  strongest: DimensionProgress | null;
  weakest: DimensionProgress | null;
  lastActive: string | null;
};

function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * Pure. Callers pass runs newest-first (the natural Firestore ordering) and
 * only runs that count towards stats — the fallback report's placeholder score
 * must never reach an average.
 */
export function computeProgress(runsNewestFirst: RunSummary[]): ProgressModel {
  const scored = runsNewestFirst.filter((run) => run.score !== null);

  const dimensions: DimensionProgress[] = subscoreDimensions.map((dimension) => {
    const series = runsNewestFirst
      .map((run) => run.subscores?.[dimension])
      .filter((value): value is number => typeof value === "number");

    const recent = series.slice(0, TREND_WINDOW);
    const previous = series.slice(TREND_WINDOW, TREND_WINDOW * 2);

    const recentMean = mean(recent);
    const previousMean = mean(previous);

    return {
      dimension,
      mastery: mean(series.slice(0, MASTERY_WINDOW)),
      // Needs both windows full, or a first-ever run would read as a huge jump.
      trend:
        recent.length === TREND_WINDOW &&
        previous.length === TREND_WINDOW &&
        recentMean !== null &&
        previousMean !== null
          ? recentMean - previousMean
          : null,
      sampleSize: series.length,
    };
  });

  const rated = dimensions.filter((entry) => entry.mastery !== null);
  const sorted = [...rated].sort((a, b) => (b.mastery ?? 0) - (a.mastery ?? 0));

  return {
    totalRuns: runsNewestFirst.length,
    averageScore: mean(scored.map((run) => run.score as number)),
    scoreSeries: [...scored]
      .reverse()
      .map((run) => ({ completedAt: run.completedAt, score: run.score as number })),
    dimensions,
    strongest: sorted[0] ?? null,
    weakest: sorted.length > 0 ? sorted[sorted.length - 1] : null,
    lastActive: runsNewestFirst[0]?.completedAt ?? null,
  };
}

export type ScoreBand = "strong" | "developing" | "needsFocus";

/** Thresholds match `scoreLabel` in the feedback deck, so bands read the same. */
export function scoreBand(score: number): ScoreBand {
  if (score >= 8) {
    return "strong";
  }

  return score >= 6 ? "developing" : "needsFocus";
}

export const scoreBandMeta: Record<
  ScoreBand,
  { label: string; ink: string; fill: string }
> = {
  strong: {
    label: "Strong",
    ink: "text-[var(--color-primary-ink)]",
    fill: "bg-[var(--color-primary)]",
  },
  developing: {
    label: "Developing",
    ink: "text-[var(--color-warning)]",
    fill: "bg-[var(--color-warning)]",
  },
  needsFocus: {
    label: "Needs focus",
    ink: "text-[var(--color-danger)]",
    fill: "bg-[var(--color-danger)]",
  },
};

export function formatTrend(trend: number | null): string {
  if (trend === null) {
    return "Not enough runs yet";
  }

  if (Math.abs(trend) < 0.25) {
    return "Holding steady";
  }

  return `${trend > 0 ? "+" : ""}${trend.toFixed(1)} vs earlier runs`;
}
