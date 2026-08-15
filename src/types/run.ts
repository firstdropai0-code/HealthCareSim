import type { ScenarioDifficulty } from "@/lib/scenarios/scenarioLibrary";
import type { FeedbackReport, SkillSubscores } from "./feedback";
import type { Scenario } from "./scenario";
import type { SimulationMessage } from "./simulation";
import type { Role } from "./user";

/**
 * A completed, scored roleplay. Written once, never updated — the rules reject
 * every update and delete, which is what stops a trainee re-running the write
 * with a better score after seeing their report.
 *
 * Several fields are denormalized on purpose: `userDisplayName` keeps the
 * mentor roster from doing one `users` read per row, and `groupId` / `mentorId`
 * let the rules authorise a read without a get().
 */
export type RunSummary = {
  id: string;
  userId: string;
  userDisplayName: string;
  groupId: string;
  mentorId: string;
  /** Role of whoever ran it — mentors practising their own cases are excluded. */
  role: Role;

  scenarioId: string;
  scenarioTitle: string;
  scenarioSummary: string;

  libraryId: string | null;
  category: string | null;
  difficulty: ScenarioDifficulty;

  startedAt: string;
  /** ISO on read; written as a server timestamp so the rules can pin it. */
  completedAt: string;

  turnCount: number;
  maxTurns: number;

  /** Null when the report was the offline fallback rather than a real score. */
  score: number | null;
  subscores: SkillSubscores | null;

  reportSource: "ai" | "fallback";

  /**
   * Stored, not derived. Every aggregate query filters on it, which makes the
   * fallback report's hardcoded score-of-6 unable to reach an average by
   * construction rather than by every call site remembering to exclude it.
   */
  countsTowardStats: boolean;
};

export type RunRecord = RunSummary & {
  report: FeedbackReport;
};

/**
 * Kept in a subcollection: transcripts carry voice metrics and are the bulk of
 * the payload, but list views never need them.
 */
export type RunTranscript = {
  messages: SimulationMessage[];
  scenario: Scenario;
};

/**
 * The anonymous projection trainees read for cohort comparison. Firestore has
 * no field-level security, so a peer's score cannot live in a document that
 * also holds their name or their transcript — it needs its own copy.
 */
export type RunStat = {
  runId: string;
  /**
   * Opaque per-person key, scoped to the group: SHA-256 of `groupId:uid`.
   *
   * Needed because "5 runs" is only a cohort if they came from several people,
   * and this projection must not carry a uid — `users/{uid}` is readable by any
   * signed-in user, so a raw uid here would resolve straight to a name.
   * Hashing keeps runs countable per person while staying unlinkable.
   */
  runnerKey: string;
  difficulty: ScenarioDifficulty;
  category: string | null;
  libraryId: string | null;
  score: number | null;
  subscores: SkillSubscores | null;
  completedAt: string;
  countsTowardStats: boolean;
};
