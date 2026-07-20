export type CustomCriterionFeedback = {
  criterion: string;
  assessment: string;
};

export type FeedbackReport = {
  overallScore: number;
  summary: string;
  whatWentWell: string[];
  whatCouldImprove: string[];
  communicationGaps: string[];
  betterResponses: string[];
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
