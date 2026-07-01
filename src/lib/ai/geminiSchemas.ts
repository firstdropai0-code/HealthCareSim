export type GeminiSchema = {
  type: "OBJECT" | "ARRAY" | "STRING" | "NUMBER" | "INTEGER" | "BOOLEAN";
  description?: string;
  properties?: Record<string, GeminiSchema>;
  items?: GeminiSchema;
  required?: string[];
  enum?: string[];
  nullable?: boolean;
};

const stringArraySchema: GeminiSchema = {
  type: "ARRAY",
  items: { type: "STRING" },
};

export const scenarioSchema: GeminiSchema = {
  type: "OBJECT",
  required: [
    "id",
    "title",
    "setting",
    "summary",
    "patientProfile",
    "patientEmotion",
    "traineeObjective",
    "communicationChallenge",
    "startingSituation",
    "firstPrompt",
    "suggestedTurns",
    "endingCondition",
    "evaluationCriteria",
    "mediaAssets",
  ],
  properties: {
    id: { type: "STRING" },
    title: { type: "STRING" },
    setting: { type: "STRING" },
    summary: { type: "STRING" },
    patientProfile: { type: "STRING" },
    patientEmotion: { type: "STRING" },
    familyEmotion: { type: "STRING", nullable: true },
    traineeObjective: { type: "STRING" },
    communicationChallenge: { type: "STRING" },
    startingSituation: { type: "STRING" },
    firstPrompt: { type: "STRING" },
    suggestedTurns: { type: "INTEGER" },
    endingCondition: { type: "STRING" },
    evaluationCriteria: stringArraySchema,
    mediaAssets: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {},
      },
    },
  },
};

export const nextSimulationTurnSchema: GeminiSchema = {
  type: "OBJECT",
  required: ["speaker", "message", "tensionLevel", "shouldEnd"],
  properties: {
    speaker: {
      type: "STRING",
      enum: ["patient", "family_member", "nurse", "bystander", "narrator"],
    },
    message: { type: "STRING" },
    tensionLevel: {
      type: "STRING",
      enum: ["low", "medium", "high"],
    },
    shouldEnd: { type: "BOOLEAN" },
  },
};

export const feedbackReportSchema: GeminiSchema = {
  type: "OBJECT",
  required: [
    "overallScore",
    "summary",
    "whatWentWell",
    "whatCouldImprove",
    "communicationGaps",
    "betterResponses",
    "finalAdvice",
  ],
  properties: {
    overallScore: { type: "INTEGER" },
    summary: { type: "STRING" },
    whatWentWell: stringArraySchema,
    whatCouldImprove: stringArraySchema,
    communicationGaps: stringArraySchema,
    betterResponses: stringArraySchema,
    finalAdvice: { type: "STRING" },
    voiceDeliveryFeedback: {
      type: "OBJECT",
      nullable: true,
      required: ["summary", "strengths", "improvements"],
      properties: {
        summary: { type: "STRING" },
        strengths: stringArraySchema,
        improvements: stringArraySchema,
      },
    },
  },
};

export const voiceTranscriptionSchema: GeminiSchema = {
  type: "OBJECT",
  required: [
    "transcript",
    "emotionEstimate",
    "paceEstimate",
    "clarityEstimate",
    "confidence",
  ],
  properties: {
    transcript: { type: "STRING" },
    emotionEstimate: {
      type: "STRING",
      enum: ["calm", "anxious", "angry", "sad", "confused", "neutral", "unknown"],
    },
    paceEstimate: {
      type: "STRING",
      enum: ["slow", "normal", "fast", "unknown"],
    },
    clarityEstimate: {
      type: "STRING",
      enum: ["clear", "mixed", "unclear", "unknown"],
    },
    confidence: {
      type: "STRING",
      enum: ["low", "medium", "high"],
    },
  },
};
export const voicePartialTranscriptionSchema: GeminiSchema = {
  type: "OBJECT",
  required: ["partialTranscript", "isUseful", "confidence"],
  properties: {
    partialTranscript: { type: "STRING" },
    isUseful: { type: "BOOLEAN" },
    confidence: {
      type: "STRING",
      enum: ["low", "medium", "high"],
    },
  },
};
