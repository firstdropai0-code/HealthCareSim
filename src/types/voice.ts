export type VoiceMetrics = {
  volumeLevel: "soft" | "normal" | "loud";
  pitchLevel: "low" | "normal" | "high" | "not_detected";
  paceLevel: "slow" | "normal" | "fast";
  pausePattern: "smooth" | "some_pauses" | "many_pauses";
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
