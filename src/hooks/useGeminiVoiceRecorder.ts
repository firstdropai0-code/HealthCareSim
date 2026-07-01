"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  VoiceMetrics,
  VoicePartialTranscriptionResult,
  VoiceTranscriptionResult,
} from "@/types/voice";

type GeminiVoicePurpose = "scenario" | "simulation";
type GeminiVoiceStatus =
  | "idle"
  | "recording"
  | "transcribing"
  | "ready"
  | "unavailable"
  | "error";

type RecorderStopResolver = (result: VoiceTranscriptionResult | null) => void;

const CHUNK_TIMESLICE_MS = 2800;

function getPreferredMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") {
    return undefined;
  }

  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
}

function getAudioExtension(type: string): string {
  if (type.includes("mp4")) {
    return "mp4";
  }

  if (type.includes("ogg")) {
    return "ogg";
  }

  return "webm";
}

function mergeTranscript(current: string, next: string): string {
  const currentText = current.trim();
  const nextText = next.trim();
  const normalizedCurrent = currentText.toLowerCase();
  const normalizedNext = nextText.toLowerCase();

  if (!nextText || normalizedCurrent.endsWith(normalizedNext)) {
    return currentText;
  }

  if (normalizedCurrent && normalizedNext.startsWith(`${normalizedCurrent} `)) {
    return nextText;
  }

  return `${currentText} ${nextText}`.trim();
}

function mapTranscriptionToVoiceMetrics(transcription: VoiceTranscriptionResult): VoiceMetrics {
  const toneMap: Record<VoiceTranscriptionResult["emotionEstimate"], VoiceMetrics["toneEstimate"]> = {
    calm: "calm",
    anxious: "tense",
    angry: "frustrated",
    sad: "uncertain",
    confused: "uncertain",
    neutral: "unknown",
    unknown: "unknown",
  };

  return {
    volumeLevel: "normal",
    pitchLevel: "not_detected",
    paceLevel: transcription.paceEstimate === "unknown" ? "normal" : transcription.paceEstimate,
    pausePattern: "smooth",
    clarityLevel: transcription.clarityEstimate,
    toneEstimate: toneMap[transcription.emotionEstimate],
    confidence: transcription.confidence,
  };
}

function buildFallbackResult(transcript: string): VoiceTranscriptionResult {
  return {
    transcript: transcript.trim(),
    emotionEstimate: "unknown",
    paceEstimate: "unknown",
    clarityEstimate: "unknown",
    confidence: "low",
  };
}

async function transcribeAudio(
  audio: Blob,
  purpose: GeminiVoicePurpose,
  context: string | undefined,
  signal?: AbortSignal,
): Promise<VoiceTranscriptionResult> {
  const formData = new FormData();
  const type = audio.type || "audio/webm";
  formData.append("audio", audio, `voice-${purpose}.${getAudioExtension(type)}`);
  formData.append("purpose", purpose);

  if (context?.trim()) {
    formData.append("context", context.trim());
  }

  const response = await fetch("/api/gemini-transcribe", {
    method: "POST",
    body: formData,
    signal,
  });
  const data = (await response.json()) as { result?: VoiceTranscriptionResult; error?: string };

  if (!response.ok || !data.result) {
    throw new Error(data.error || "Gemini could not transcribe the audio.");
  }

  return data.result;
}

async function transcribeChunk(
  audio: Blob,
  purpose: GeminiVoicePurpose,
  context: string,
  previousTranscript: string,
  signal: AbortSignal,
): Promise<VoicePartialTranscriptionResult> {
  const formData = new FormData();
  const type = audio.type || "audio/webm";
  formData.append("audio", audio, `voice-chunk-${purpose}.${getAudioExtension(type)}`);
  formData.append("purpose", purpose);

  if (context.trim()) {
    formData.append("context", context.trim());
  }

  if (previousTranscript.trim()) {
    formData.append("previousTranscript", previousTranscript.trim());
  }

  const response = await fetch("/api/gemini-transcribe-chunk", {
    method: "POST",
    body: formData,
    signal,
  });
  const data = (await response.json()) as VoicePartialTranscriptionResult & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || "Gemini could not update live captions yet.");
  }

  return data;
}

export function useGeminiVoiceRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const purposeRef = useRef<GeminiVoicePurpose>("simulation");
  const contextRef = useRef("");
  const liveTranscriptRef = useRef("");
  const sessionIdRef = useRef(0);
  const stoppingRef = useRef(false);
  const stopResolverRef = useRef<RecorderStopResolver | null>(null);
  const chunkQueueRef = useRef<Promise<void>>(Promise.resolve());
  const chunkAbortControllersRef = useRef<Set<AbortController>>(new Set());
  const finalAbortControllerRef = useRef<AbortController | null>(null);

  const [status, setStatus] = useState<GeminiVoiceStatus>("idle");
  const [supported, setSupported] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [result, setResult] = useState<VoiceTranscriptionResult | null>(null);
  const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortChunkRequests = useCallback(() => {
    chunkAbortControllersRef.current.forEach((controller) => controller.abort());
    chunkAbortControllersRef.current.clear();
    chunkQueueRef.current = Promise.resolve();
  }, []);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    stoppingRef.current = false;
  }, []);

  const resetFinalRequest = useCallback(() => {
    finalAbortControllerRef.current?.abort();
    finalAbortControllerRef.current = null;
  }, []);

  const resetTranscriptState = useCallback(() => {
    liveTranscriptRef.current = "";
    setLiveTranscript("");
    setFinalTranscript("");
    setResult(null);
    setVoiceMetrics(null);
    setError(null);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSupported(Boolean(navigator.mediaDevices?.getUserMedia) && typeof window.MediaRecorder !== "undefined");
    }, 0);

    return () => {
      window.clearTimeout(timer);
      sessionIdRef.current += 1;
      abortChunkRequests();
      resetFinalRequest();
      cleanupStream();
    };
  }, [abortChunkRequests, cleanupStream, resetFinalRequest]);

  const enqueueChunkTranscription = useCallback(
    (audio: Blob, sessionId: number) => {
      chunkQueueRef.current = chunkQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (sessionId !== sessionIdRef.current || stoppingRef.current || audio.size === 0) {
            return;
          }

          const controller = new AbortController();
          chunkAbortControllersRef.current.add(controller);

          try {
            const partial = await transcribeChunk(
              audio,
              purposeRef.current,
              contextRef.current,
              liveTranscriptRef.current,
              controller.signal,
            );

            if (sessionId !== sessionIdRef.current || controller.signal.aborted || !partial.isUseful) {
              return;
            }

            const nextTranscript = mergeTranscript(liveTranscriptRef.current, partial.partialTranscript);
            liveTranscriptRef.current = nextTranscript;
            setLiveTranscript(nextTranscript);
            setError(null);
          } catch {
            if (sessionId === sessionIdRef.current && !controller.signal.aborted && !stoppingRef.current) {
              setError("Still recording. Caption update delayed.");
            }
          } finally {
            chunkAbortControllersRef.current.delete(controller);
          }
        });
    },
    [],
  );

  const startRecording = useCallback(
    async (purpose: GeminiVoicePurpose, context = "") => {
      if (!supported) {
        setStatus("unavailable");
        setError("Gemini voice is not available. Please check microphone access or type your response.");
        return false;
      }

      sessionIdRef.current += 1;
      abortChunkRequests();
      resetFinalRequest();
      cleanupStream();
      resetTranscriptState();
      purposeRef.current = purpose;
      contextRef.current = context;
      chunksRef.current = [];
      stoppingRef.current = false;
      const sessionId = sessionIdRef.current;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = getPreferredMimeType();
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

        recorder.ondataavailable = (event) => {
          if (event.data.size <= 0 || sessionId !== sessionIdRef.current) {
            return;
          }

          const chunk = new Blob([event.data], { type: recorder.mimeType || event.data.type || "audio/webm" });
          chunksRef.current.push(chunk);

          if (!stoppingRef.current) {
            enqueueChunkTranscription(chunk, sessionId);
          }
        };

        recorder.onstop = () => {
          const audio = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          cleanupStream();
          abortChunkRequests();
          setStatus("transcribing");

          if (sessionId !== sessionIdRef.current) {
            stopResolverRef.current?.(null);
            stopResolverRef.current = null;
            return;
          }

          const controller = new AbortController();
          finalAbortControllerRef.current = controller;

          void transcribeAudio(audio, purposeRef.current, contextRef.current, controller.signal)
            .then((nextResult) => {
              if (sessionId !== sessionIdRef.current || controller.signal.aborted) {
                stopResolverRef.current?.(null);
                return;
              }

              setResult(nextResult);
              setFinalTranscript(nextResult.transcript);
              setLiveTranscript(nextResult.transcript);
              liveTranscriptRef.current = nextResult.transcript;
              setVoiceMetrics(mapTranscriptionToVoiceMetrics(nextResult));
              setError(null);
              setStatus("ready");
              stopResolverRef.current?.(nextResult);
            })
            .catch(() => {
              if (sessionId !== sessionIdRef.current || controller.signal.aborted) {
                stopResolverRef.current?.(null);
                return;
              }

              const fallbackTranscript = liveTranscriptRef.current.trim();

              if (fallbackTranscript) {
                const fallbackResult = buildFallbackResult(fallbackTranscript);
                setResult(fallbackResult);
                setFinalTranscript(fallbackTranscript);
                setVoiceMetrics(mapTranscriptionToVoiceMetrics(fallbackResult));
                setError(null);
                setStatus("ready");
                stopResolverRef.current?.(fallbackResult);
                return;
              }

              setError("Gemini could not transcribe the audio. Please try again or type your response.");
              setStatus("error");
              stopResolverRef.current?.(null);
            })
            .finally(() => {
              if (finalAbortControllerRef.current === controller) {
                finalAbortControllerRef.current = null;
              }
              stopResolverRef.current = null;
            });
        };

        mediaRecorderRef.current = recorder;
        streamRef.current = stream;
        recorder.start(CHUNK_TIMESLICE_MS);
        setStatus("recording");
        return true;
      } catch (recordingError) {
        cleanupStream();
        setStatus("error");
        setError(
          recordingError instanceof DOMException && recordingError.name === "NotAllowedError"
            ? "Microphone permission was blocked. Please allow microphone access or type your response."
            : recordingError instanceof Error
              ? recordingError.message
              : "Gemini voice is not available. Please try again or type your response.",
        );
        return false;
      }
    },
    [abortChunkRequests, cleanupStream, enqueueChunkTranscription, resetFinalRequest, resetTranscriptState, supported],
  );

  const stopRecording = useCallback((): Promise<VoiceTranscriptionResult | null> => {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      return Promise.resolve(null);
    }

    stoppingRef.current = true;
    setStatus("transcribing");

    return new Promise((resolve) => {
      stopResolverRef.current = resolve;

      try {
        recorder.requestData();
      } catch {
        // Some browsers throw if requestData happens too close to stop; stop still flushes data.
      }

      recorder.stop();
    });
  }, []);

  const reset = useCallback(() => {
    sessionIdRef.current += 1;
    abortChunkRequests();
    resetFinalRequest();
    cleanupStream();
    stopResolverRef.current?.(null);
    stopResolverRef.current = null;
    resetTranscriptState();
    setStatus(supported ? "idle" : "unavailable");
  }, [abortChunkRequests, cleanupStream, resetFinalRequest, resetTranscriptState, supported]);

  return {
    startRecording,
    stopRecording,
    reset,
    liveTranscript,
    finalTranscript,
    status,
    error,
    supported,
    result,
    voiceMetrics,
    isRecording: status === "recording",
    isTranscribing: status === "transcribing",
  };
}
