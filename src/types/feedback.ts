export type FeedbackReport = {
  overallScore: number;
  summary: string;
  whatWentWell: string[];
  whatCouldImprove: string[];
  communicationGaps: string[];
  betterResponses: string[];
  finalAdvice: string;
  voiceDeliveryFeedback?: {
    summary: string;
    strengths: string[];
    improvements: string[];
  };
};
