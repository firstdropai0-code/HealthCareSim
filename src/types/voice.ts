/**
 * Delivery metrics for one spoken trainee turn.
 *
 * Every sub-object is nullable on purpose: pitch and loudness come from the raw
 * mic audio (unavailable if Web Audio is blocked), pace and pauses come from
 * word timestamps (unavailable if the transcription returns no timings). The
 * feedback prompt only mentions what is actually present.
 */

export type PaceLabel = "slow" | "measured" | "brisk" | "rushed";
export type PausePosition = "early" | "mid" | "late" | "scattered";
export type PitchStability = "steady" | "variable" | "unsteady";
export type LoudnessLabel = "quiet" | "even" | "projected" | "uneven";
export type ConfidenceLevel = "settled" | "mostly-steady" | "finding-footing";

export type PaceMetrics = {
  wordsPerMinute: number;
  label: PaceLabel;
};

export type PauseMetrics = {
  count: number;
  totalSec: number;
  longestSec: number;
  position: PausePosition | null;
};

export type PitchMetrics = {
  meanHz: number;
  rangeHz: number;
  variabilityHz: number;
  stability: PitchStability;
};

export type LoudnessMetrics = {
  meanRms: number;
  variability: number;
  label: LoudnessLabel;
};

export type FillerMetrics = {
  count: number;
  perMinute: number;
  topWords: string[];
};

/**
 * Soft, inferred coaching cue -- deliberately a label plus its reasons, never a
 * number. It describes how the delivery sounded, not how capable the trainee is.
 */
export type ConfidenceSignal = {
  level: ConfidenceLevel;
  basis: string[];
};

export type VoiceMetrics = {
  durationSec: number;
  pace: PaceMetrics | null;
  pauses: PauseMetrics | null;
  pitch: PitchMetrics | null;
  loudness: LoudnessMetrics | null;
  fillers: FillerMetrics | null;
  confidenceSignal: ConfidenceSignal | null;
};

/** Raw per-frame audio features collected in the browser while recording. */
export type AudioFeatureSample = {
  /** Seconds since recording started. */
  time: number;
  /** Detected fundamental frequency in Hz, or null when the frame is unvoiced. */
  pitchHz: number | null;
  /** Root-mean-square amplitude of the frame, 0-1. */
  rms: number;
};

/** A single word with its timing, from the transcription response. */
export type TranscribedWord = {
  word: string;
  start: number;
  end: number;
};
