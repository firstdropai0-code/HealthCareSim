import {
  GENERAL_CATEGORY,
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
  /**
   * The level to do next in this track: the lowest tier with a case to run
   * that has not been cleared yet. At most one per track.
   *
   * A suggestion, not a gate. Levels used to lock until the one below was
   * cleared, but nothing else enforced that -- My Cases offered every assigned
   * case regardless -- and the mentor already decides what a trainee may run
   * by choosing what to publish. So every level with a case is startable, and
   * the tree only points at a sensible order.
   */
  suggested: boolean;
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

/** Score at which a level counts as cleared. */
export const CLEAR_SCORE = 6;

/**
 * A missing category becomes the catch-all track rather than being dropped.
 *
 * Cases written from a free-typed idea carry no category, and the tree matches
 * runs to cells by category — so anything null had no row to land in and
 * vanished from progress entirely, case and runs alike.
 */
function trackOf(category: string | null | undefined): string {
  return category && category.trim() ? category : GENERAL_CATEGORY;
}

/**
 * Categories come from the library so the map has a stable shape even before a
 * mentor has published anything. Any category a mentor sets on their own case is
 * folded in too, so nothing a trainee runs is homeless.
 */
export function buildSkillTree(cases: AssignedCase[] = []): SkillNode[] {
  const categories = [
    ...new Set([
      ...scenarioLibrary.map((entry) => entry.category),
      ...cases.map((entry) => trackOf(entry.category)),
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
 * fallback report's placeholder score can never clear a level or move a mastery
 * figure.
 */
export function computeSkillTree(
  runs: RunSummary[],
  cases: AssignedCase[] = [],
): SkillNodeProgress[] {
  const tree = buildSkillTree(cases);

  const progress = tree.map((node) => {
    const matching = runs.filter(
      (run) => trackOf(run.category) === node.category && run.difficulty === node.difficulty,
    );
    const scores = matching.map((run) => run.score).filter((score): score is number => score !== null);
    const cleared = scores.some((score) => score >= CLEAR_SCORE);

    const inCell = cases.filter(
      (entry) => trackOf(entry.category) === node.category && entry.difficulty === node.difficulty,
    );
    const attemptedIds = new Set(matching.map((run) => run.scenarioId));
    const availableCaseIds = [
      ...inCell.filter((entry) => attemptedIds.has(entry.scenario.id)),
      ...inCell.filter((entry) => !attemptedIds.has(entry.scenario.id)),
    ].map((entry) => entry.id);

    return {
      ...node,
      suggested: false,
      availableCount: inCell.length,
      availableCaseIds,
      runCount: matching.length,
      bestScore: scores.length > 0 ? Math.max(...scores) : null,
      mastery: meanOf(scores),
      cleared,
      unset: inCell.length === 0 && matching.length === 0,
    };
  });

  // One suggestion per track: walk its tiers in order and stop at the first
  // one with a case to run that is not yet cleared. Nodes arrive grouped by
  // track in tier order from buildSkillTree, but matching on category keeps
  // this from depending on that.
  const tracks = [...new Set(progress.map((node) => node.category))];

  for (const track of tracks) {
    const next = difficultyOrder
      .map((difficulty) =>
        progress.find((node) => node.category === track && node.difficulty === difficulty),
      )
      .find((node) => node && node.availableCount > 0 && !node.cleared);

    if (next) {
      next.suggested = true;
    }
  }

  return progress;
}
