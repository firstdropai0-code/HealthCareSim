export type VoiceMetrics = {
  volumeLevel: "soft" | "normal" | "loud";
  pitchLevel: "low" | "normal" | "high" | "not_detected";
  paceLevel: "slow" | "normal" | "fast";
  pausePattern: "smooth" | "some_pauses" | "many_pauses";
  clarityLevel?: "clear" | "mixed" | "unclear" | "unknown";
  toneEstimate:
    | "calm"
    | "confident"
    | "empathetic"
    | "rushed"
    | "tense"
    | "uncertain"
    | "frustrated"
    | "unknown";
  confidence: "low" | "medium" | "high";
  raw?: {
    averageVolume?: number;
    averagePitchHz?: number;
    wordsPerMinute?: number;
    pauseCount?: number;
    durationSeconds?: number;
  };
};

export type VoiceCaptureResult = {
  transcript: string;
  metrics: VoiceMetrics;
};

export type VoiceTranscriptionResult = {
  transcript: string;
  emotionEstimate: "calm" | "anxious" | "angry" | "sad" | "confused" | "neutral" | "unknown";
  paceEstimate: "slow" | "normal" | "fast" | "unknown";
  clarityEstimate: "clear" | "mixed" | "unclear" | "unknown";
  confidence: "low" | "medium" | "high";
};

export type VoicePartialTranscriptionResult = {
  partialTranscript: string;
  isUseful: boolean;
  confidence: "low" | "medium" | "high";
};
