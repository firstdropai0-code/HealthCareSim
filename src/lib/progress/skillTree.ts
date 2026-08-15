import {
  difficultyMeta,
  difficultyOrder,
  scenarioLibrary,
  type ScenarioDifficulty,
} from "@/lib/scenarios/scenarioLibrary";
import type { AssignedCase } from "@/types/assignedCase";
import type { RunSummary } from "@/types/run";

/**
 * The tree is a `category x difficulty` lattice giving the shape of the whole
 * programme. The grid comes from the case library, but what a trainee can
 * actually run comes from their mentor: cells are populated by PUBLISHED cases,
 * not by the library. A cell with nothing published is marked unset rather than
 * advertising a case the trainee has no way to start.
 */
export type SkillNode = {
  id: string;
  category: string;
  difficulty: ScenarioDifficulty;
};

export type SkillNodeProgress = SkillNode & {
  unlocked: boolean;
  /** Why it is locked, phrased as something the trainee can act on. */
  lockedHint: string;
  /** Cases the mentor has published in this cell. */
  availableCount: number;
  /**
   * Ids of those cases, best retry first: the one they already attempted here
   * leads, so "try again" means the same case rather than an unrelated one.
   */
  availableCaseIds: string[];
  runCount: number;
  /** Their best score in this cell, for the retry prompt. Null with no runs. */
  bestScore: number | null;
  /** Mean overall score across matching runs; null with no runs. */
  mastery: number | null;
  /** True once at least one run in this cell scored 6 or better. */
  cleared: boolean;
  /** Nothing published and nothing run: not part of this trainee's programme. */
  unset: boolean;
};

/** Score at which a case counts as cleared for unlocking the next tier. */
export const CLEAR_SCORE = 6;
/** Escape hatch: this many runs at the previous tier, in any track, also opens. */
export const CROSS_TRACK_UNLOCK_RUNS = 3;

/**
 * Categories come from the library so the map has a stable shape even before a
 * mentor has published anything. Any category the mentor invents by publishing
 * a free-typed case is folded in too, so nothing a trainee runs is homeless.
 */
export function buildSkillTree(cases: AssignedCase[] = []): SkillNode[] {
  const categories = [
    ...new Set([
      ...scenarioLibrary.map((entry) => entry.category),
      ...cases.map((entry) => entry.category).filter((value): value is string => Boolean(value)),
    ]),
  ].sort();

  return categories.flatMap((category) =>
    difficultyOrder.map((difficulty) => ({
      id: `${category}::${difficulty}`,
      category,
      difficulty,
    })),
  );
}

function meanOf(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

/**
 * Only scored runs are passed in — callers query on `countsTowardStats`, so the
 * fallback report's placeholder score can never unlock a node or move a mastery
 * figure.
 */
export function computeSkillTree(
  runs: RunSummary[],
  cases: AssignedCase[] = [],
): SkillNodeProgress[] {
  const tree = buildSkillTree(cases);

  const runsAtTier = (difficulty: ScenarioDifficulty) =>
    runs.filter((run) => run.difficulty === difficulty);

  return tree.map((node) => {
    const matching = runs.filter(
      (run) => run.category === node.category && run.difficulty === node.difficulty,
    );
    const scores = matching.map((run) => run.score).filter((score): score is number => score !== null);
    const cleared = scores.some((score) => score >= CLEAR_SCORE);

    const inCell = cases.filter(
      (entry) => entry.category === node.category && entry.difficulty === node.difficulty,
    );
    const attemptedIds = new Set(matching.map((run) => run.scenarioId));
    const availableCaseIds = [
      ...inCell.filter((entry) => attemptedIds.has(entry.scenario.id)),
      ...inCell.filter((entry) => !attemptedIds.has(entry.scenario.id)),
    ].map((entry) => entry.id);

    const tierIndex = difficultyOrder.indexOf(node.difficulty);
    const previousTier = tierIndex > 0 ? difficultyOrder[tierIndex - 1] : null;

    let unlocked = true;
    let lockedHint = "";

    if (previousTier) {
      const previousInTrack = runs.filter(
        (run) => run.category === node.category && run.difficulty === previousTier,
      );
      const clearedPreviousInTrack = previousInTrack.some(
        (run) => run.score !== null && run.score >= CLEAR_SCORE,
      );
      // Nobody should be hard-blocked by one stubborn track, so broad practice
      // at the tier below opens the next one anywhere.
      const broadPractice = runsAtTier(previousTier).length >= CROSS_TRACK_UNLOCK_RUNS;

      unlocked = clearedPreviousInTrack || broadPractice;

      if (!unlocked) {
        // Only offer the in-track route when there is actually a case to run
        // there. Otherwise it names an impossible action, which is how this
        // read before published cases drove the counts.
        const previousTierIsRunnable = cases.some(
          (entry) => entry.category === node.category && entry.difficulty === previousTier,
        );

        lockedHint = previousTierIsRunnable
          ? `Score ${CLEAR_SCORE}+ on a ${difficultyMeta[previousTier].label.toLowerCase()} case in this track to open it.`
          : `Complete ${CROSS_TRACK_UNLOCK_RUNS} ${difficultyMeta[previousTier].label.toLowerCase()} cases to open this level.`;
      }
    }

    return {
      ...node,
      unlocked,
      lockedHint,
      availableCount: inCell.length,
      availableCaseIds,
      runCount: matching.length,
      bestScore: scores.length > 0 ? Math.max(...scores) : null,
      mastery: meanOf(scores),
      cleared,
      unset: inCell.length === 0 && matching.length === 0,
    };
  });
}
