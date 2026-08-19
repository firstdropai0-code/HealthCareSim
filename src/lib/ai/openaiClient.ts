"use client";

/**
 * Client helpers for the OpenAI audio routes. These mirror the raw-fetch style
 * of geminiClient.ts: the API key stays server-side, the browser only talks to
 * our own /api/openai/* handlers.
 */

import type { TranscribedWord } from "@/types/voice";

export type TranscriptionResult = {
  text: string;
  /** Word timings, empty when the model/response did not provide them. */
  words: TranscribedWord[];
  /** Audio duration reported by the API, when available. */
  duration?: number;
};

export async function transcribeAudio(audio: Blob): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append("file", audio, "recording.webm");

  const response = await fetch("/api/openai/transcribe", {
    method: "POST",
    body: formData,
  });

  const data = (await response.json().catch(() => null)) as
    | { text?: string; words?: TranscribedWord[]; duration?: number; error?: string }
    | null;

  if (!response.ok || !data) {
    throw new Error(data?.error || "Transcription failed. Please try again.");
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
};

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
      reject(new Error("Audio playback failed."));
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
    throw new Error("There is nothing to read aloud.");
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
    }),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || "Could not generate audio. Please try again.");
  }

  const blob = await response.blob();

  if (options.signal?.aborted) {
    throw abortError();
  }

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  let settled = false;
  let frame: number | null = null;

  const cleanup = () => {
    if (settled) {
      return;
    }
    settled = true;

    if (frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
    }

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

  try {
    // Unwrapped on purpose: the rejection is the DOMException the autoplay and
    // abort classifiers need to see.
    await audio.play();
  } catch (error) {
    cleanup();
    resolveFinished();
    throw error;
  }

  const { onProgress } = options;

  if (onProgress) {
    const tick = () => {
      if (settled) {
        return;
      }

      onProgress({ elapsedMs: audio.currentTime * 1000, durationMs });
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
