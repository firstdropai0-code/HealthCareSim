"use client";

import { computeRms, detectPitchHz } from "./pitchDetector";
import type { AudioFeatureSample } from "@/types/voice";

/**
 * Taps the live mic stream while recording and accumulates pitch/loudness
 * frames. Runs alongside MediaRecorder off the same MediaStream, so it adds no
 * extra permission prompt and no second capture.
 *
 * Analysis happens here in the browser rather than server-side because the raw
 * float samples are already available for free at record time; doing it on the
 * server would mean decoding webm/opus in a serverless route.
 */

/** How often to sample the analyser, in ms. 10 frames/sec is ample for pitch
 *  range and loudness trends, and keeps detection cost off the main thread's back. */
const SAMPLE_INTERVAL_MS = 100;

/** Frame size for the analyser. Must be a power of two, and long enough to hold
 *  a couple of periods of the lowest pitch we look for. */
const FFT_SIZE = 2048;

export type VoiceFeatureCollector = {
  /** Stop sampling, release the audio graph, and return what was collected. */
  stop: () => { samples: AudioFeatureSample[]; durationSec: number };
};

type AudioContextConstructor = typeof AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext ||
    null
  );
}

/**
 * Start collecting features from the given stream. Returns null (never throws)
 * when Web Audio is unavailable or blocked, so recording still works and the
 * pitch/loudness metrics simply come back missing.
 */
export function startVoiceFeatureCollection(stream: MediaStream): VoiceFeatureCollector | null {
  const AudioContextCtor = getAudioContextConstructor();

  if (!AudioContextCtor) {
    return null;
  }

  let context: AudioContext;

  try {
    context = new AudioContextCtor();
  } catch {
    return null;
  }

  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  source.connect(analyser);
  // Deliberately not connected to context.destination -- routing the mic to the
  // speakers would echo the trainee back at themselves.

  const buffer = new Float32Array(analyser.fftSize);
  const samples: AudioFeatureSample[] = [];
  const startedAt = performance.now();

  const timer = window.setInterval(() => {
    analyser.getFloatTimeDomainData(buffer);

    samples.push({
      time: (performance.now() - startedAt) / 1000,
      pitchHz: detectPitchHz(buffer, context.sampleRate),
      rms: computeRms(buffer),
    });
  }, SAMPLE_INTERVAL_MS);

  let stopped = false;

  return {
    stop() {
      const durationSec = (performance.now() - startedAt) / 1000;

      if (!stopped) {
        stopped = true;
        window.clearInterval(timer);
        source.disconnect();
        analyser.disconnect();
        void context.close().catch(() => {
          // Closing is best-effort; a failure here must not break the recording.
        });
      }

      return { samples, durationSec };
    },
  };
}
