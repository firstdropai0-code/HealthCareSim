export type FeedbackReport = {
  overallScore: number;
  summary: string;
  whatWentWell: string[];
  whatCouldImprove: string[];
  communicationGaps: string[];
  betterResponses: string[];
  finalAdvice: string;
  source?: "ai" | "fallback";
  fallbackReason?: string;
};
