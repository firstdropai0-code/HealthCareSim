/**
 * Autocorrelation pitch detection, kept in-repo rather than pulling in a
 * dependency (this project otherwise ships only next/react).
 *
 * This is the standard normalised-autocorrelation approach: find the lag at
 * which the signal best correlates with itself, and read the fundamental
 * frequency off that lag. Good enough for speech-range coaching signals; it is
 * not trying to be a music-grade tuner.
 */

/** Human speech fundamentals sit roughly in this band; ignore anything outside. */
const MIN_PITCH_HZ = 70;
const MAX_PITCH_HZ = 400;

/** Frames quieter than this are silence/breath, not voiced speech. */
const MIN_RMS_FOR_PITCH = 0.01;

/** Below this correlation the "pitch" is noise, so report unvoiced instead. */
const MIN_CORRELATION = 0.9;

/**
 * Cap on how many samples each lag comparison walks. Without this the detector
 * is O(lags x frame) per frame and burns real time on the main thread; 1024
 * samples still covers several periods at speech frequencies.
 */
const MAX_CORRELATION_WINDOW = 1024;

/** Root-mean-square amplitude of a frame, 0-1. */
export function computeRms(samples: Float32Array): number {
  let sum = 0;

  for (let index = 0; index < samples.length; index += 1) {
    sum += samples[index] * samples[index];
  }

  return Math.sqrt(sum / samples.length);
}

/**
 * Detect the fundamental frequency of one frame, or null when the frame is too
 * quiet or too noisy to call. Callers should treat null as "no data for this
 * frame" rather than as a zero.
 */
export function detectPitchHz(samples: Float32Array, sampleRate: number): number | null {
  const rms = computeRms(samples);

  if (rms < MIN_RMS_FOR_PITCH) {
    return null;
  }

  const minLag = Math.floor(sampleRate / MAX_PITCH_HZ);
  const maxLag = Math.min(Math.floor(sampleRate / MIN_PITCH_HZ), samples.length - 1);

  if (maxLag <= minLag) {
    return null;
  }

  let bestLag = -1;
  let bestCorrelation = 0;

  // Normalised autocorrelation: dividing by the frame's own energy keeps the
  // score comparable across loud and quiet frames.
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let correlation = 0;
    let energyHead = 0;
    let energyLagged = 0;
    const length = Math.min(samples.length - lag, MAX_CORRELATION_WINDOW);

    for (let index = 0; index < length; index += 1) {
      correlation += samples[index] * samples[index + lag];
      energyHead += samples[index] * samples[index];
      energyLagged += samples[index + lag] * samples[index + lag];
    }

    const denominator = Math.sqrt(energyHead * energyLagged);
    const normalised = denominator > 0 ? correlation / denominator : 0;

    if (normalised > bestCorrelation) {
      bestCorrelation = normalised;
      bestLag = lag;
    }
  }

  if (bestLag < 0 || bestCorrelation < MIN_CORRELATION) {
    return null;
  }

  const frequency = sampleRate / bestLag;

  return frequency >= MIN_PITCH_HZ && frequency <= MAX_PITCH_HZ ? frequency : null;
}
