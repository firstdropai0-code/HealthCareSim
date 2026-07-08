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
  finalAdvice: string;
  customCriteriaFeedback?: CustomCriterionFeedback[];
  source?: "ai" | "fallback";
  fallbackReason?: string;
};
