import type { ScenarioDifficulty } from "@/lib/scenarios/scenarioLibrary";
import type { RunStat } from "@/types/run";

/**
 * Both thresholds are needed. Five runs from one prolific trainee is not a
 * cohort, and "you are 1st of 2" is noise dressed as feedback.
 */
export const MIN_COHORT_RUNS = 5;
export const MIN_COHORT_TRAINEES = 3;

export type CohortBucket = {
  /** How the peer group was chosen, for honest labelling. */
  kind: "library-case" | "category-difficulty" | "difficulty";
  label: string;
  stats: RunStat[];
};

export type CohortComparison =
  | {
      ready: false;
      bucketLabel: string;
      runCount: number;
      traineeCount: number;
      requiredRuns: number;
      requiredTrainees: number;
    }
  | {
      ready: true;
      bucketLabel: string;
      runCount: number;
      traineeCount: number;
      mean: number;
      p25: number;
      p50: number;
      p75: number;
      /** The trainee's own score, and where it falls. Null if they have none. */
      yourScore: number | null;
      yourPercentile: number | null;
    };

/**
 * First match wins: the same case is the most comparable thing there is, then
 * the same track at the same tier, then just the tier.
 */
export function selectBucket(
  stats: RunStat[],
  target: { libraryId: string | null; category: string | null; difficulty: ScenarioDifficulty },
): CohortBucket {
  if (target.libraryId) {
    const sameCase = stats.filter((stat) => stat.libraryId === target.libraryId);
    if (sameCase.length >= MIN_COHORT_RUNS) {
      return { kind: "library-case", label: "this case", stats: sameCase };
    }
  }

  if (target.category) {
    const sameTrack = stats.filter(
      (stat) => stat.category === target.category && stat.difficulty === target.difficulty,
    );
    if (sameTrack.length >= MIN_COHORT_RUNS) {
      return {
        kind: "category-difficulty",
        label: `${target.category} at ${target.difficulty} level`,
        stats: sameTrack,
      };
    }
  }

  return {
    kind: "difficulty",
    label: `${target.difficulty} cases`,
    stats: stats.filter((stat) => stat.difficulty === target.difficulty),
  };
}

function percentile(sortedAscending: number[], fraction: number): number {
  if (sortedAscending.length === 0) {
    return 0;
  }

  const index = Math.min(
    sortedAscending.length - 1,
    Math.max(0, Math.round(fraction * (sortedAscending.length - 1))),
  );

  return sortedAscending[index];
}

/**
 * Counts people who actually ran, not people who joined — a group of five where
 * only one has practised is not a cohort of five.
 */
export function countRunners(stats: RunStat[]): number {
  return new Set(stats.map((stat) => stat.runnerKey).filter(Boolean)).size;
}

export function computeCohort(
  bucket: CohortBucket,
  yourScore: number | null,
): CohortComparison {
  const traineeCount = countRunners(bucket.stats);
  const scores = bucket.stats
    .map((stat) => stat.score)
    .filter((score): score is number => score !== null)
    .sort((a, b) => a - b);

  if (scores.length < MIN_COHORT_RUNS || traineeCount < MIN_COHORT_TRAINEES) {
    return {
      ready: false,
      bucketLabel: bucket.label,
      runCount: scores.length,
      traineeCount,
      requiredRuns: MIN_COHORT_RUNS,
      requiredTrainees: MIN_COHORT_TRAINEES,
    };
  }

  const total = scores.reduce((sum, score) => sum + score, 0);

  return {
    ready: true,
    bucketLabel: bucket.label,
    runCount: scores.length,
    traineeCount,
    mean: total / scores.length,
    p25: percentile(scores, 0.25),
    p50: percentile(scores, 0.5),
    p75: percentile(scores, 0.75),
    yourScore,
    yourPercentile:
      yourScore === null
        ? null
        : Math.round(
            (scores.filter((score) => score < yourScore).length / scores.length) * 100,
          ),
  };
}

/** Buckets scores 1-10 into a histogram for the mentor's distribution chart. */
export function scoreHistogram(scores: number[]): { score: number; count: number }[] {
  return Array.from({ length: 10 }, (_, index) => ({
    score: index + 1,
    count: scores.filter((score) => Math.round(score) === index + 1).length,
  }));
}
