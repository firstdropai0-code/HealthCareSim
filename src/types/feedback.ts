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

export type FeedbackReport = {
  overallScore: number;
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
