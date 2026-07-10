"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { transcribeAudio } from "@/lib/ai/openaiClient";

export type VoiceRecorderStatus = "idle" | "recording" | "transcribing" | "error";

export type UseVoiceRecorder = {
  status: VoiceRecorderStatus;
  error: string | null;
  isSupported: boolean;
  start: () => Promise<void>;
  /** Stop recording and resolve with the transcript (empty string on failure). */
  stop: () => Promise<string>;
};

function isMediaRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof window.MediaRecorder === "function"
  );
}

/**
 * Records a short clip via getUserMedia + MediaRecorder, then sends it to the
 * OpenAI transcription route and returns the transcript. Handles mic-permission
 * denial and unsupported browsers without throwing to the caller.
 */
export function useVoiceRecorder(): UseVoiceRecorder {
  const [status, setStatus] = useState<VoiceRecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Defer the capability check to a microtask so we never call setState
    // synchronously inside the effect body (matches the repo's effect pattern).
    const timer = window.setTimeout(() => setIsSupported(isMediaRecordingSupported()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => releaseStream, [releaseStream]);

  const start = useCallback(async () => {
    if (!isMediaRecordingSupported()) {
      setIsSupported(false);
      setStatus("error");
      setError("Voice input is not supported in this browser.");
      return;
    }

    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
    } catch (err) {
      releaseStream();
      setStatus("error");
      setError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission was denied. Enable it to use voice input."
          : "Could not start recording. Check your microphone and try again.",
      );
    }
  }, [releaseStream]);

  const stop = useCallback((): Promise<string> => {
    const recorder = recorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      releaseStream();
      setStatus("idle");
      return Promise.resolve("");
    }

    return new Promise<string>((resolve) => {
      recorder.onstop = async () => {
        const chunks = chunksRef.current;
        releaseStream();

        if (chunks.length === 0) {
          setStatus("idle");
          resolve("");
          return;
        }

        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        setStatus("transcribing");

        try {
          const text = await transcribeAudio(blob);
          setStatus("idle");
          resolve(text);
        } catch (err) {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Transcription failed. Please try again.");
          resolve("");
        }
      };

      recorder.stop();
    });
  }, [releaseStream]);

  return { status, error, isSupported, start, stop };
}
