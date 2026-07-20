import type {
  AudioFeatureSample,
  ConfidenceSignal,
  FillerMetrics,
  LoudnessMetrics,
  PaceMetrics,
  PauseMetrics,
  PitchMetrics,
  TranscribedWord,
  VoiceMetrics,
} from "@/types/voice";

/**
 * Turns raw capture data into the compact VoiceMetrics object the feedback
 * prompt consumes. Pace/pauses/fillers come from word timestamps; pitch and
 * loudness come from the browser's Web Audio frames.
 *
 * Every section returns null rather than a fabricated default when its inputs
 * are missing, so downstream code can tell "not captured" from "captured, low".
 */

/** A gap longer than this between consecutive words counts as a pause. */
const PAUSE_THRESHOLD_SEC = 0.6;

/** Speech-rate bands in words per minute, based on typical conversational speech. */
const PACE_BANDS: { max: number; label: PaceMetrics["label"] }[] = [
  { max: 110, label: "slow" },
  { max: 150, label: "measured" },
  { max: 185, label: "brisk" },
  { max: Infinity, label: "rushed" },
];

const FILLER_WORDS = [
  "um",
  "uh",
  "er",
  "ah",
  "hmm",
  "like",
  "basically",
  "actually",
  "literally",
  "sorta",
  "kinda",
  "yeah",
];

/** Multi-word fillers need phrase matching rather than token matching. */
const FILLER_PHRASES = ["you know", "i mean", "sort of", "kind of"];

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const average = mean(values);
  const variance = mean(values.map((value) => (value - average) ** 2));

  return Math.sqrt(variance);
}

export function computePace(words: TranscribedWord[]): PaceMetrics | null {
  if (words.length < 3) {
    return null;
  }

  const spokenSec = words[words.length - 1].end - words[0].start;

  if (spokenSec <= 0) {
    return null;
  }

  const wordsPerMinute = (words.length / spokenSec) * 60;
  const label = PACE_BANDS.find((band) => wordsPerMinute <= band.max)?.label ?? "measured";

  return { wordsPerMinute: Math.round(wordsPerMinute), label };
}

export function computePauses(words: TranscribedWord[]): PauseMetrics | null {
  if (words.length < 3) {
    return null;
  }

  const start = words[0].start;
  const spokenSec = words[words.length - 1].end - start;

  if (spokenSec <= 0) {
    return null;
  }

  const gaps: { duration: number; at: number }[] = [];

  for (let index = 1; index < words.length; index += 1) {
    const duration = words[index].start - words[index - 1].end;

    if (duration >= PAUSE_THRESHOLD_SEC) {
      gaps.push({ duration, at: (words[index - 1].end - start) / spokenSec });
    }
  }

  if (gaps.length === 0) {
    return { count: 0, totalSec: 0, longestSec: 0, position: null };
  }

  // Describe roughly where the pauses fell: clustered in one third of the turn,
  // or spread across it. Enough for coaching, without over-claiming precision.
  const thirds = { early: 0, mid: 0, late: 0 };

  gaps.forEach((gap) => {
    if (gap.at < 1 / 3) {
      thirds.early += 1;
    } else if (gap.at < 2 / 3) {
      thirds.mid += 1;
    } else {
      thirds.late += 1;
    }
  });

  const dominant = (Object.entries(thirds) as [PauseMetrics["position"] & string, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0];

  return {
    count: gaps.length,
    totalSec: round(gaps.reduce((total, gap) => total + gap.duration, 0)),
    longestSec: round(Math.max(...gaps.map((gap) => gap.duration))),
    position: dominant[1] > gaps.length / 2 ? dominant[0] : "scattered",
  };
}

export function computeFillers(transcript: string, durationSec: number): FillerMetrics | null {
  const normalised = transcript.toLowerCase();

  if (!normalised.trim()) {
    return null;
  }

  const counts = new Map<string, number>();

  FILLER_PHRASES.forEach((phrase) => {
    const matches = normalised.match(new RegExp(`\\b${phrase}\\b`, "g"));
    if (matches?.length) {
      counts.set(phrase, matches.length);
    }
  });

  const tokens = normalised.match(/[a-z']+/g) || [];

  tokens.forEach((token) => {
    if (FILLER_WORDS.includes(token)) {
      counts.set(token, (counts.get(token) || 0) + 1);
    }
  });

  const count = Array.from(counts.values()).reduce((total, value) => total + value, 0);
  const topWords = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => word);

  return {
    count,
    perMinute: durationSec > 0 ? round((count / durationSec) * 60) : 0,
    topWords,
  };
}

export function computePitch(samples: AudioFeatureSample[]): PitchMetrics | null {
  const pitches = samples
    .map((sample) => sample.pitchHz)
    .filter((pitch): pitch is number => pitch !== null);

  // Too few voiced frames to say anything meaningful about pitch.
  if (pitches.length < 10) {
    return null;
  }

  // Trim the extremes before measuring range: a couple of octave-jump artefacts
  // from the detector should not read as expressive range.
  const sorted = [...pitches].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * 0.05);
  const trimmed = sorted.slice(trim, sorted.length - trim || sorted.length);
  const variabilityHz = standardDeviation(trimmed);
  const meanHz = mean(trimmed);

  // Express stability relative to the speaker's own mean, so a low-pitched and a
  // high-pitched voice are judged on the same scale.
  const relativeVariability = meanHz > 0 ? variabilityHz / meanHz : 0;
  const stability: PitchMetrics["stability"] =
    relativeVariability < 0.12 ? "steady" : relativeVariability < 0.25 ? "variable" : "unsteady";

  return {
    meanHz: Math.round(meanHz),
    rangeHz: Math.round(trimmed[trimmed.length - 1] - trimmed[0]),
    variabilityHz: Math.round(variabilityHz),
    stability,
  };
}

export function computeLoudness(samples: AudioFeatureSample[]): LoudnessMetrics | null {
  // Ignore near-silent frames so pauses don't drag the average down.
  const levels = samples.map((sample) => sample.rms).filter((rms) => rms > 0.005);

  if (levels.length < 10) {
    return null;
  }

  const meanRms = mean(levels);
  const deviation = standardDeviation(levels);
  const relativeVariability = meanRms > 0 ? deviation / meanRms : 0;

  const label: LoudnessMetrics["label"] =
    relativeVariability > 0.6
      ? "uneven"
      : meanRms < 0.03
        ? "quiet"
        : meanRms > 0.12
          ? "projected"
          : "even";

  return {
    meanRms: round(meanRms, 3),
    variability: round(relativeVariability, 2),
    label,
  };
}

/**
 * Infer a soft delivery cue from the other metrics.
 *
 * This is deliberately a label plus its reasons, not a score: it says what the
 * delivery sounded like, and the prompt is instructed to voice it as
 * encouragement. It is not a measurement of the trainee's actual confidence.
 */
export function inferConfidenceSignal(
  metrics: Omit<VoiceMetrics, "confidenceSignal">,
): ConfidenceSignal | null {
  const basis: string[] = [];
  let unsettledPoints = 0;
  let available = 0;

  if (metrics.pace) {
    available += 1;
    if (metrics.pace.label === "rushed") {
      unsettledPoints += 1;
      basis.push("speech was fast");
    } else if (metrics.pace.label === "slow") {
      basis.push("speech was unhurried");
    } else {
      basis.push("pace was comfortable");
    }
  }

  if (metrics.pauses) {
    available += 1;
    if (metrics.pauses.count >= 4 || metrics.pauses.longestSec >= 2) {
      unsettledPoints += 1;
      basis.push("several long pauses mid-sentence");
    } else {
      basis.push("pausing was natural");
    }
  }

  if (metrics.pitch) {
    available += 1;
    if (metrics.pitch.stability === "unsteady") {
      unsettledPoints += 1;
      basis.push("pitch moved around a lot");
    } else {
      basis.push("tone held steady");
    }
  }

  if (metrics.loudness) {
    available += 1;
    if (metrics.loudness.label === "quiet" || metrics.loudness.label === "uneven") {
      unsettledPoints += 1;
      basis.push(`volume was ${metrics.loudness.label}`);
    } else {
      basis.push("volume carried well");
    }
  }

  // Needs at least two inputs to be worth saying anything about.
  if (available < 2) {
    return null;
  }

  const ratio = unsettledPoints / available;
  const level: ConfidenceSignal["level"] =
    ratio <= 0.25 ? "settled" : ratio <= 0.5 ? "mostly-steady" : "finding-footing";

  return { level, basis };
}

export type BuildVoiceMetricsInput = {
  transcript: string;
  words: TranscribedWord[];
  samples: AudioFeatureSample[];
  durationSec: number;
};

/** Assemble the full metrics object, degrading section by section. */
export function buildVoiceMetrics({
  transcript,
  words,
  samples,
  durationSec,
}: BuildVoiceMetricsInput): VoiceMetrics {
  const base = {
    durationSec: round(durationSec),
    pace: computePace(words),
    pauses: computePauses(words),
    pitch: computePitch(samples),
    loudness: computeLoudness(samples),
    fillers: computeFillers(transcript, durationSec),
  };

  return { ...base, confidenceSignal: inferConfidenceSignal(base) };
}

/** Duration-weighted average, ignoring entries that lack the value. */
function weightedMean(entries: { value: number; weight: number }[]): number | null {
  const usable = entries.filter((entry) => entry.weight > 0);

  if (usable.length === 0) {
    return null;
  }

  const totalWeight = usable.reduce((total, entry) => total + entry.weight, 0);

  return usable.reduce((total, entry) => total + entry.value * entry.weight, 0) / totalWeight;
}

/**
 * Combine metrics from several spoken stretches into one summary -- used both
 * for a draft assembled from multiple dictations and for the whole simulation
 * when building the feedback prompt.
 *
 * Rates (pace, fillers-per-minute) and levels (pitch, loudness) are averaged
 * weighted by duration so a long turn counts for more than a two-word one;
 * counts (pauses, filler words) are summed. The confidence signal is re-derived
 * from the combined picture rather than averaged from the parts.
 */
export function aggregateVoiceMetrics(entries: VoiceMetrics[]): VoiceMetrics | null {
  const usable = entries.filter(Boolean);

  if (usable.length === 0) {
    return null;
  }

  if (usable.length === 1) {
    return usable[0];
  }

  const durationSec = usable.reduce((total, entry) => total + entry.durationSec, 0);
  const weightOf = (entry: VoiceMetrics) => entry.durationSec || 1;

  const withPace = usable.filter((entry) => entry.pace);
  const withPauses = usable.filter((entry) => entry.pauses);
  const withPitch = usable.filter((entry) => entry.pitch);
  const withLoudness = usable.filter((entry) => entry.loudness);
  const withFillers = usable.filter((entry) => entry.fillers);

  const wordsPerMinute = weightedMean(
    withPace.map((entry) => ({ value: entry.pace!.wordsPerMinute, weight: weightOf(entry) })),
  );

  const pace: PaceMetrics | null =
    wordsPerMinute === null
      ? null
      : {
          wordsPerMinute: Math.round(wordsPerMinute),
          label: PACE_BANDS.find((band) => wordsPerMinute <= band.max)?.label ?? "measured",
        };

  const pauses: PauseMetrics | null =
    withPauses.length === 0
      ? null
      : {
          count: withPauses.reduce((total, entry) => total + entry.pauses!.count, 0),
          totalSec: round(withPauses.reduce((total, entry) => total + entry.pauses!.totalSec, 0)),
          longestSec: round(Math.max(...withPauses.map((entry) => entry.pauses!.longestSec))),
          // Position is only meaningful within a single stretch of speech, so
          // across several it collapses to "scattered" unless they all agree.
          position: withPauses.every(
            (entry) => entry.pauses!.position === withPauses[0].pauses!.position,
          )
            ? withPauses[0].pauses!.position
            : "scattered",
        };

  const meanHz = weightedMean(
    withPitch.map((entry) => ({ value: entry.pitch!.meanHz, weight: weightOf(entry) })),
  );
  const variabilityHz = weightedMean(
    withPitch.map((entry) => ({ value: entry.pitch!.variabilityHz, weight: weightOf(entry) })),
  );

  const pitch: PitchMetrics | null =
    meanHz === null || variabilityHz === null
      ? null
      : {
          meanHz: Math.round(meanHz),
          rangeHz: Math.round(Math.max(...withPitch.map((entry) => entry.pitch!.rangeHz))),
          variabilityHz: Math.round(variabilityHz),
          stability:
            variabilityHz / meanHz < 0.12
              ? "steady"
              : variabilityHz / meanHz < 0.25
                ? "variable"
                : "unsteady",
        };

  const meanRms = weightedMean(
    withLoudness.map((entry) => ({ value: entry.loudness!.meanRms, weight: weightOf(entry) })),
  );
  const loudnessVariability = weightedMean(
    withLoudness.map((entry) => ({ value: entry.loudness!.variability, weight: weightOf(entry) })),
  );

  const loudness: LoudnessMetrics | null =
    meanRms === null || loudnessVariability === null
      ? null
      : {
          meanRms: round(meanRms, 3),
          variability: round(loudnessVariability, 2),
          label:
            loudnessVariability > 0.6
              ? "uneven"
              : meanRms < 0.03
                ? "quiet"
                : meanRms > 0.12
                  ? "projected"
                  : "even",
        };

  const fillerCount = withFillers.reduce((total, entry) => total + entry.fillers!.count, 0);
  const fillerWordTotals = new Map<string, number>();

  withFillers.forEach((entry) => {
    entry.fillers!.topWords.forEach((word) => {
      fillerWordTotals.set(word, (fillerWordTotals.get(word) || 0) + 1);
    });
  });

  const fillers: FillerMetrics | null =
    withFillers.length === 0
      ? null
      : {
          count: fillerCount,
          perMinute: durationSec > 0 ? round((fillerCount / durationSec) * 60) : 0,
          topWords: Array.from(fillerWordTotals.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([word]) => word),
        };

  const base = { durationSec: round(durationSec), pace, pauses, pitch, loudness, fillers };

  return { ...base, confidenceSignal: inferConfidenceSignal(base) };
}
