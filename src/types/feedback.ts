export type CustomCriterionFeedback = {
  criterion: string;
  assessment: string;
};

/**
 * A suggested line, tied to the moment in the conversation it answers.
 *
 * `respondsToTurn` is 1-based over the scenario (patient/family/nurse/narrator)
 * messages only, counting the opening line as 1 — the trainee always replies to
 * one of those, so it is the only numbering the model can hit reliably. Both
 * anchoring fields are optional: reports generated before this existed, and the
 * fallback report, carry the suggestion alone.
 */
export type BetterResponse = {
  suggestion: string;
  respondsToTurn?: number;
  /** Short quote of the moment, as the model identified it. */
  inResponseTo?: string;
};

/**
 * Per-dimension scores, 1-10 each, from the same model call as `overallScore`.
 * These are the axes of the skill tree and of cohort comparison.
 *
 * There is deliberately NO `delivery` dimension. Delivery coaching comes from a
 * separate model call that never sees the scoring context — see the header of
 * `src/lib/prompts/feedbackPrompt.ts`. Scoring it here would collapse that
 * separation and make "delivery does not affect the score" untrue. Do not
 * "complete the set".
 *
 * `overallScore` is NOT their mean. The rubric caps the overall at 3 for a
 * single hostile line, and an average cannot express that.
 */
export type SkillSubscores = {
  empathy: number;
  clarity: number;
  /** Structure & next steps: scenario management, checking understanding. */
  structure: number;
  professionalism: number;
  /** Pressure & de-escalation. */
  deEscalation: number;
};

export const subscoreDimensions = [
  "empathy",
  "clarity",
  "structure",
  "professionalism",
  "deEscalation",
] as const;

export type SubscoreDimension = (typeof subscoreDimensions)[number];

export const subscoreLabels: Record<SubscoreDimension, string> = {
  empathy: "Empathy",
  clarity: "Clarity",
  structure: "Structure & next steps",
  professionalism: "Professionalism",
  deEscalation: "Pressure & de-escalation",
};

export type FeedbackReport = {
  overallScore: number;
  /** Absent on older reports and on the fallback report. */
  subscores?: SkillSubscores;
  summary: string;
  whatWentWell: string[];
  whatCouldImprove: string[];
  communicationGaps: string[];
  betterResponses: BetterResponse[];
  /**
   * Coaching on HOW the trainee spoke, from the voice metrics. Empty when the
   * trainee typed their turns or delivery analysis was unavailable.
   */
  deliveryFeedback?: string[];
  finalAdvice: string;
  customCriteriaFeedback?: CustomCriterionFeedback[];
  source?: "ai" | "fallback";
  fallbackReason?: string;
};
