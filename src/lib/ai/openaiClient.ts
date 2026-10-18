"use client";

/**
 * Client helpers for the OpenAI audio routes. These mirror the raw-fetch style
 * of geminiClient.ts: the API key stays server-side, the browser only talks to
 * our own /api/openai/* handlers.
 */

import { localizeServerError, translate } from "@/lib/i18n/strings";
import type { AppLanguage } from "@/types/language";
import type { TranscribedWord } from "@/types/voice";

export type TranscriptionResult = {
  text: string;
  /** Word timings, empty when the model/response did not provide them. */
  words: TranscribedWord[];
  /** Audio duration reported by the API, when available. */
  duration?: number;
};

export async function transcribeAudio(
  audio: Blob,
  language?: AppLanguage,
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append("file", audio, "recording.webm");

  // Whisper auto-detect mistakes accented English for Hindi or Urdu, so the
  // route pins a language. Which one is a per-recording question, not a
  // deployment one: a Hindi case needs Hindi even on an English-default server.
  if (language) {
    formData.append("language", language);
  }

  const response = await fetch("/api/openai/transcribe", {
    method: "POST",
    body: formData,
  });

  const data = (await response.json().catch(() => null)) as
    | { text?: string; words?: TranscribedWord[]; duration?: number; error?: string }
    | null;

  if (!response.ok || !data) {
    throw new Error(localizeServerError(data?.error, "error.transcriptionFailed"));
  }

  return {
    text: (data.text || "").trim(),
    words: Array.isArray(data.words) ? data.words : [],
    ...(typeof data.duration === "number" ? { duration: data.duration } : {}),
  };
}

export type SpeakTextOptions = {
  voice?: string;
  instructions?: string;
  /**
   * Delivery rank for this line. Only ElevenLabs uses it -- OpenAI takes its
   * direction as prose in `instructions` -- but it is resolved from the same
   * inputs so both providers rank a line the same way.
   */
  intensity?: string;
  /** Raw per-line stage direction, for ElevenLabs' optional audio tags. */
  delivery?: string;
  /**
   * The same line with its audio tags intact. Sent alongside rather than
   * instead of `text`: only a provider that performs tags should ever see them,
   * and which provider is running is a server-side decision.
   */
  spokenText?: string;
  /**
   * Cancels the TTS fetch. Without this a stop pressed during the network wait
   * could not be honoured -- the playback handle does not exist yet, so there
   * is nothing to call stop() on and the audio starts anyway.
   */
  signal?: AbortSignal;
  /**
   * Called on every animation frame while audio is playing, with the position
   * read from the element itself. A caller-side clock drifts from this on
   * buffering stalls and in background tabs.
   */
  onProgress?: (progress: { elapsedMs: number; durationMs: number | null }) => void;
  /**
   * Called on every animation frame with how loud the clip is right now, 0 to
   * 1, and with 0 once it stops. Best effort: where the browser will not let
   * the clip be metered, this is simply never called and playback is
   * unaffected.
   */
  onLevel?: (level: number) => void;
};

/*
 * One context for the whole page. Browsers cap how many can exist, and each
 * turn would otherwise open another.
 */
let meterContext: AudioContext | null = null;

/** How long to wait for a suspended context to start before giving up on it. */
const METER_RESUME_TIMEOUT_MS = 150;

/**
 * Route the clip through an analyser so its loudness can be read each frame.
 * Returns a sampler and a detach, or null when metering is not possible.
 *
 * The ordering is the safety: once an element is handed to a context its
 * sound plays THROUGH that context, so a suspended context means silence. The
 * context is therefore confirmed running before the element is connected, and
 * every failure returns null before anything is rerouted -- the worst case is
 * a portrait that does not pulse, never a character who goes quiet. The resume
 * wait is capped because a context with no user gesture can stay pending
 * indefinitely, and that must not hold up the voice.
 */
async function attachLevelMeter(
  audio: HTMLAudioElement,
): Promise<{ sample: () => number; detach: () => void } | null> {
  try {
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!Context) {
      return null;
    }

    meterContext ??= new Context();
    const context = meterContext;

    if (context.state !== "running") {
      await Promise.race([
        context.resume(),
        new Promise((resolve) => setTimeout(resolve, METER_RESUME_TIMEOUT_MS)),
      ]);
    }

    if (context.state !== "running") {
      return null;
    }

    const source = context.createMediaElementSource(audio);
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    analyser.connect(context.destination);

    const samples = new Uint8Array(analyser.fftSize);

    return {
      sample() {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;

        for (const value of samples) {
          const centred = (value - 128) / 128;
          sum += centred * centred;
        }

        // Speech RMS rarely passes ~0.3, so scale it up to use the ring's
        // whole range; the square root keeps quiet syllables visible.
        return Math.min(1, Math.sqrt(Math.sqrt(sum / samples.length) / 0.3));
      },
      detach() {
        source.disconnect();
        analyser.disconnect();
      },
    };
  } catch {
    return null;
  }
}

export type SpeechPlayback = {
  /**
   * Null when the encoded duration is not finite, which rules out mapping
   * progress onto anything. Callers fall back to a timer.
   */
  durationMs: number | null;
  /** Resolves when playback finishes (or rejects if it fails). */
  finished: Promise<void>;
  /** Stop playback immediately and release the audio resource. */
  stop: () => void;
};

/**
 * A browser refusing to play without a user gesture. Not an error worth showing
 * as one -- the caller offers a button instead.
 */
export function isAutoplayBlockedError(error: unknown): boolean {
  return (
    typeof DOMException !== "undefined" &&
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "SecurityError")
  );
}

/** A deliberate cancellation, which the caller has already accounted for. */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function abortError(): DOMException {
  return new DOMException("Audio request was cancelled.", "AbortError");
}

/**
 * Resolve once the element knows how long it is, so the duration is available
 * before playback starts rather than a frame or two into it.
 */
function loadAudioMetadata(audio: HTMLAudioElement, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      resolve();
      return;
    }

    const detach = () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("error", onError);
      signal?.removeEventListener("abort", onAbort);
    };

    function onLoaded() {
      detach();
      resolve();
    }

    function onError() {
      detach();
      reject(new Error(translate("error.playbackFailed")));
    }

    function onAbort() {
      detach();
      reject(abortError());
    }

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("error", onError);
    signal?.addEventListener("abort", onAbort);
    audio.load();
  });
}

/**
 * POST the given text to /api/openai/tts, then play the returned mp3 through an
 * Audio element. The object URL is revoked once playback ends or is stopped.
 *
 * This resolves only once audio is genuinely playing, which is what lets a
 * caller line text up against the voice. The element itself is deliberately not
 * returned: the revoke-once logic below is what keeps the blob from leaking,
 * and a caller holding the element could re-play a revoked URL.
 */
export async function speakText(
  text: string,
  options: SpeakTextOptions = {},
): Promise<SpeechPlayback> {
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error(translate("error.nothingToRead"));
  }

  const response = await fetch("/api/openai/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: trimmed,
      ...(options.voice ? { voice: options.voice } : {}),
      ...(options.instructions ? { instructions: options.instructions } : {}),
      ...(options.intensity ? { intensity: options.intensity } : {}),
      ...(options.delivery ? { delivery: options.delivery } : {}),
      ...(options.spokenText ? { spokenText: options.spokenText } : {}),
    }),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(localizeServerError(data?.error, "error.audioFailed"));
  }

  const blob = await response.blob();

  if (options.signal?.aborted) {
    throw abortError();
  }

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  let settled = false;
  let frame: number | null = null;
  let meter: Awaited<ReturnType<typeof attachLevelMeter>> = null;

  const cleanup = () => {
    if (settled) {
      return;
    }
    settled = true;

    if (frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }

    meter?.detach();
    options.onLevel?.(0);
    URL.revokeObjectURL(url);
  };

  try {
    await loadAudioMetadata(audio, options.signal);
  } catch (error) {
    cleanup();
    throw error;
  }

  // Some mp3s arrive without a Xing header and report Infinity here. There is
  // no ratio to map in that case, so say so rather than guess.
  const durationMs =
    Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration * 1000 : null;

  let resolveFinished: () => void = () => {};
  let rejectFinished: (error: Error) => void = () => {};

  const finished = new Promise<void>((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });

  audio.onended = () => {
    cleanup();
    resolveFinished();
  };

  audio.onerror = () => {
    cleanup();
    rejectFinished(new Error("Audio playback failed."));
  };

  // Before play(), not after: connecting an element that is already sounding
  // makes an audible jump as its output moves into the context.
  if (options.onLevel) {
    meter = await attachLevelMeter(audio);
  }

  try {
    // Unwrapped on purpose: the rejection is the DOMException the autoplay and
    // abort classifiers need to see.
    await audio.play();
  } catch (error) {
    cleanup();
    resolveFinished();
    throw error;
  }

  const { onProgress, onLevel } = options;
  const activeMeter = meter;

  if (onProgress || (onLevel && activeMeter)) {
    const tick = () => {
      if (settled) {
        return;
      }

      onProgress?.({ elapsedMs: audio.currentTime * 1000, durationMs });

      if (onLevel && activeMeter) {
        onLevel(activeMeter.sample());
      }

      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
  }

  const stop = () => {
    audio.pause();
    audio.currentTime = 0;
    cleanup();
    // Resolve (rather than reject) so an awaiting caller unwinds cleanly on a
    // deliberate stop. Resolving twice is a no-op if playback already ended.
    resolveFinished();
  };

  return { durationMs, finished, stop };
}
