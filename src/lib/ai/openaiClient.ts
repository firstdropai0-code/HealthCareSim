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
};

export type SpeechPlayback = {
  /** Resolves when playback finishes (or rejects if it fails). */
  finished: Promise<void>;
  /** Stop playback immediately and release the audio resource. */
  stop: () => void;
};

/**
 * POST the given text to /api/openai/tts, then play the returned mp3 through an
 * Audio element. The object URL is revoked once playback ends or is stopped.
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
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error || "Could not generate audio. Please try again.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);

  let settled = false;
  let resolveFinished: () => void = () => {};

  const finished = new Promise<void>((resolve, reject) => {
    resolveFinished = resolve;

    const cleanup = () => {
      if (settled) {
        return;
      }
      settled = true;
      URL.revokeObjectURL(url);
    };

    audio.onended = () => {
      cleanup();
      resolve();
    };

    audio.onerror = () => {
      cleanup();
      reject(new Error("Audio playback failed."));
    };

    audio.play().catch((error) => {
      cleanup();
      reject(error instanceof Error ? error : new Error("Audio playback failed."));
    });
  });

  const stop = () => {
    audio.pause();
    audio.currentTime = 0;
    if (!settled) {
      settled = true;
      URL.revokeObjectURL(url);
    }
    // Resolve (rather than reject) so an awaiting caller unwinds cleanly on a
    // deliberate stop. Resolving twice is a no-op if playback already ended.
    resolveFinished();
  };

  return { finished, stop };
}
