"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceTranscriptionResult } from "@/types/voice";

type GeminiVoicePurpose = "scenario" | "simulation";
type GeminiVoiceStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "ready"
  | "unavailable"
  | "error";

type RecorderStopResolver = (result: VoiceTranscriptionResult | null) => void;

function getPreferredMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }

  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

async function transcribeAudio(
  audio: Blob,
  purpose: GeminiVoicePurpose,
  context?: string,
): Promise<VoiceTranscriptionResult> {
  const formData = new FormData();
  formData.append("audio", audio, `voice-${purpose}.${audio.type.includes("mp4") ? "mp4" : "webm"}`);
  formData.append("purpose", purpose);

  if (context?.trim()) {
    formData.append("context", context.trim());
  }

  const response = await fetch("/api/gemini-transcribe", {
    method: "POST",
    body: formData,
  });
  const data = (await response.json()) as { result?: VoiceTranscriptionResult; error?: string };

  if (!response.ok || !data.result) {
    throw new Error(data.error || "Gemini voice transcription failed.");
  }

  return data.result;
}

export function useGeminiVoiceRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const purposeRef = useRef<GeminiVoicePurpose>("simulation");
  const contextRef = useRef("");
  const stopResolverRef = useRef<RecorderStopResolver | null>(null);

  const [status, setStatus] = useState<GeminiVoiceStatus>("idle");
  const [supported, setSupported] = useState(false);
  const [result, setResult] = useState<VoiceTranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSupported(Boolean(navigator.mediaDevices?.getUserMedia) && typeof window.MediaRecorder !== "undefined");
    }, 0);

    return () => {
      window.clearTimeout(timer);
      cleanupStream();
    };
  }, [cleanupStream]);

  const startRecording = useCallback(
    async (purpose: GeminiVoicePurpose, context = "") => {
      if (!supported) {
        setStatus("unavailable");
        setError("Gemini voice unavailable. Using text/browser fallback.");
        return false;
      }

      cleanupStream();
      setError(null);
      setResult(null);
      purposeRef.current = purpose;
      contextRef.current = context;
      chunksRef.current = [];

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = getPreferredMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          const audio = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          cleanupStream();
          setStatus("transcribing");

          void transcribeAudio(audio, purposeRef.current, contextRef.current)
            .then((nextResult) => {
              setResult(nextResult);
              setStatus("ready");
              stopResolverRef.current?.(nextResult);
            })
            .catch((transcriptionError: unknown) => {
              setError(
                transcriptionError instanceof Error
                  ? transcriptionError.message
                  : "Gemini voice unavailable. Using text/browser fallback.",
              );
              setStatus("error");
              stopResolverRef.current?.(null);
            })
            .finally(() => {
              stopResolverRef.current = null;
            });
        };

        mediaRecorderRef.current = recorder;
        streamRef.current = stream;
        recorder.start();
        setStatus("recording");
        return true;
      } catch (recordingError) {
        cleanupStream();
        setStatus("error");
        setError(
          recordingError instanceof DOMException && recordingError.name === "NotAllowedError"
            ? "Microphone permission was blocked. Using text/browser fallback."
            : recordingError instanceof Error
              ? recordingError.message
              : "Gemini voice unavailable. Using text/browser fallback.",
        );
        return false;
      }
    },
    [cleanupStream, supported],
  );

  const stopRecording = useCallback((): Promise<VoiceTranscriptionResult | null> => {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      return Promise.resolve(null);
    }

    setStatus("transcribing");

    return new Promise((resolve) => {
      stopResolverRef.current = resolve;
      recorder.stop();
    });
  }, []);

  const reset = useCallback(() => {
    cleanupStream();
    stopResolverRef.current?.(null);
    stopResolverRef.current = null;
    setStatus(supported ? "idle" : "unavailable");
    setResult(null);
    setError(null);
  }, [cleanupStream, supported]);

  return {
    startRecording,
    stopRecording,
    reset,
    status,
    supported,
    result,
    error,
    isRecording: status === "recording",
    isTranscribing: status === "transcribing",
  };
}


