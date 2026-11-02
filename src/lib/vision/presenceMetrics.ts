import type {
  CalibrationResult,
  PresenceBaseline,
  PresenceSample,
  PresenceThresholds,
  PresenceWindowMetrics,
  VisiblePresenceSample,
} from "@/types/presence";

/**
 * Turns raw webcam readings into behaviour metrics. Pure functions, no browser
 * APIs, the same split as voiceFeatureCollector.ts and voiceMetrics.ts -- which
 * also means the lab page can re-judge a finished test when a threshold changes.
 *
 * Every number in this file is a first guess until `/lab/presence` has been run
 * on real people. Tune them there.
 */

export const DEFAULT_THRESHOLDS: PresenceThresholds = {
  yawToleranceDeg: 20,
  pitchToleranceDeg: 15,
};

/* Below this much visible face, a window says nothing rather than something wrong. */
const MIN_VISIBLE_RATIO = 0.7;

const MIN_CALIBRATION_SAMPLES = 10;
const MIN_CALIBRATION_VISIBLE_RATIO = 0.6;
/* Median drift allowed while calibrating. More means the "resting" pose isn't one. */
const MAX_CALIBRATION_DRIFT_DEG = 6;

/* Shorter than this is tracking noise or a twitch of the head, not a look away. */
const MIN_LOOK_AWAY_SEC = 0.4;
/* Two away stretches this close together are one look with a tracking flicker in it. */
const LOOK_AWAY_MERGE_GAP_SEC = 0.3;
/* A sample stands for the time until the next one, but never for longer than
   this: a stalled tab should not read as seconds of looking away. */
const MAX_SAMPLE_SPAN_SEC = 0.5;

/* About a second of readings. Less is too little to say anything about. */
const MIN_WINDOW_SAMPLES = 10;

/* Roughly reading aloud in your head, which is the pace someone takes in a line
   they care about. Bounded so a short line still gets a look and a long one
   doesn't run on into the time they spend thinking of a reply. */
const READING_MS_PER_WORD = 300;
const MIN_READING_MS = 2_000;
const MAX_READING_MS = 30_000;

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function visibleOnly(samples: PresenceSample[]): VisiblePresenceSample[] {
  return samples.filter((sample): sample is VisiblePresenceSample => sample.faceVisible);
}

/** The time each sample stands for: up to the next sample, capped. */
function sampleSpans(samples: PresenceSample[]): number[] {
  const typicalSpan = 0.1;

  return samples.map((sample, index) => {
    const next = samples[index + 1];
    return next ? Math.min(next.time - sample.time, MAX_SAMPLE_SPAN_SEC) : typicalSpan;
  });
}

/**
 * Learn this person's resting pose from a few seconds of them looking at the
 * patient. Refuses rather than guesses: every later reading is judged against
 * this, so a bad baseline quietly makes the whole run wrong.
 */
export function calibrate(samples: PresenceSample[]): CalibrationResult {
  const visible = visibleOnly(samples);

  if (
    visible.length < MIN_CALIBRATION_SAMPLES ||
    visible.length / samples.length < MIN_CALIBRATION_VISIBLE_RATIO
  ) {
    return { ok: false, reason: "face-not-visible" };
  }

  const yawDeg = median(visible.map((sample) => sample.yawDeg));
  const pitchDeg = median(visible.map((sample) => sample.pitchDeg));
  const yawDrift = median(visible.map((sample) => Math.abs(sample.yawDeg - yawDeg)));
  const pitchDrift = median(visible.map((sample) => Math.abs(sample.pitchDeg - pitchDeg)));

  if (yawDrift > MAX_CALIBRATION_DRIFT_DEG || pitchDrift > MAX_CALIBRATION_DRIFT_DEG) {
    return { ok: false, reason: "too-much-movement" };
  }

  return { ok: true, baseline: { yawDeg, pitchDeg } };
}

export function isHeadAway(
  sample: VisiblePresenceSample,
  baseline: PresenceBaseline,
  thresholds: PresenceThresholds,
): boolean {
  return (
    Math.abs(sample.yawDeg - baseline.yawDeg) > thresholds.yawToleranceDeg ||
    Math.abs(sample.pitchDeg - baseline.pitchDeg) > thresholds.pitchToleranceDeg
  );
}

/**
 * Stretches of looking away, with tracking flicker removed. A lost face counts
 * as away: turning far enough to look at a phone is often what loses it.
 * `reliable` is what stops a covered camera being read as inattention.
 */
function findLookAways(away: boolean[], spans: number[]): number[] {
  const stretches: number[] = [];
  let current = 0;
  let gap = 0;

  away.forEach((isAway, index) => {
    if (isAway) {
      current += gap + spans[index];
      gap = 0;
      return;
    }

    if (current === 0) {
      return;
    }

    gap += spans[index];

    if (gap >= LOOK_AWAY_MERGE_GAP_SEC) {
      stretches.push(current);
      current = 0;
      gap = 0;
    }
  });

  if (current > 0) {
    stretches.push(current);
  }

  return stretches.filter((duration) => duration >= MIN_LOOK_AWAY_SEC);
}

/** How long a line takes to read when nobody is speaking it aloud. */
export function readingWindowMs(text: string): number {
  const words = text.trim().split(/\s+/).length;

  return Math.min(MAX_READING_MS, Math.max(MIN_READING_MS, words * READING_MS_PER_WORD));
}

export function computeWindowMetrics(
  samples: PresenceSample[],
  baseline: PresenceBaseline,
  thresholds: PresenceThresholds = DEFAULT_THRESHOLDS,
): PresenceWindowMetrics {
  const spans = sampleSpans(samples);
  const duration = sum(spans);
  const safeDuration = duration > 0 ? duration : 1;

  const visibleTime = sum(spans.filter((_, index) => samples[index].faceVisible));
  const faceVisibleRatio = visibleTime / safeDuration;

  const lookAways = findLookAways(
    samples.map((sample) => !sample.faceVisible || isHeadAway(sample, baseline, thresholds)),
    spans,
  );

  return {
    durationSec: duration,
    faceVisibleRatio,
    reliable: samples.length > 0 && faceVisibleRatio >= MIN_VISIBLE_RATIO,
    facingRatio: samples.length > 0 ? Math.max(0, 1 - sum(lookAways) / safeDuration) : 0,
    lookAwayCount: lookAways.length,
    longestLookAwaySec: lookAways.length > 0 ? Math.max(...lookAways) : 0,
  };
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * One window ready to go on the message, or null when it's too short to mean
 * anything. Rounded because the sample rate can't justify more digits than this,
 * and the whole run goes to localStorage and the API on every turn.
 */
export function summariseWindow(
  samples: PresenceSample[],
  baseline: PresenceBaseline,
  thresholds: PresenceThresholds = DEFAULT_THRESHOLDS,
): PresenceWindowMetrics | null {
  if (samples.length < MIN_WINDOW_SAMPLES) {
    return null;
  }

  const metrics = computeWindowMetrics(samples, baseline, thresholds);

  return {
    ...metrics,
    durationSec: round(metrics.durationSec, 1),
    faceVisibleRatio: round(metrics.faceVisibleRatio, 2),
    facingRatio: round(metrics.facingRatio, 2),
    longestLookAwaySec: round(metrics.longestLookAwaySec, 1),
  };
}
