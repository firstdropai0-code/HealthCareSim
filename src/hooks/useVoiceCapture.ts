"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { VoiceCaptureResult, VoiceMetrics } from "@/types/voice";

type SpeechRecognitionConstructor = new () => SpeechRecognition;

type SpeechRecognitionEventResult = {
  readonly isFinal: boolean;
  readonly 0: SpeechRecognitionAlternative;
};

type SpeechRecognitionResultListLike = {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionEventResult;
};

type SpeechRecognitionEventLike = Event & {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
};

type SpeechRecognition = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionAlternative = {
  readonly transcript: string;
};

type WindowWithAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

type WindowWithSpeechRecognition = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type VoiceStopReason = "manual" | "auto" | "error" | null;

function average(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeTranscript(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isLikelyMobileBrowser(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    /Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent) ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function detectPitchHz(buffer: Float32Array, sampleRate: number): number | undefined {
  const rms = Math.sqrt(buffer.reduce((sum, sample) => sum + sample * sample, 0) / buffer.length);

  if (rms < 0.01) {
    return undefined;
  }

  let bestOffset = -1;
  let bestCorrelation = 0;
  const minOffset = Math.floor(sampleRate / 350);
  const maxOffset = Math.floor(sampleRate / 85);

  for (let offset = minOffset; offset <= maxOffset; offset += 1) {
    let correlation = 0;

    for (let index = 0; index < buffer.length - offset; index += 1) {
      correlation += 1 - Math.abs(buffer[index] - buffer[index + offset]);
    }

    correlation /= buffer.length - offset;

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  if (bestCorrelation < 0.88 || bestOffset <= 0) {
    return undefined;
  }

  return sampleRate / bestOffset;
}

function classifyMetrics(
  transcript: string,
  volumes: number[],
  pitches: number[],
  pauseCount: number,
  durationSeconds: number,
): VoiceMetrics {
  const averageVolume = average(volumes);
  const averagePitchHz = average(pitches);
  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  const wordsPerMinute = durationSeconds > 0 ? (wordCount / durationSeconds) * 60 : undefined;

  const volumeLevel =
    averageVolume === undefined ? "normal" : averageVolume < 0.025 ? "soft" : averageVolume > 0.09 ? "loud" : "normal";
  const pitchLevel =
    averagePitchHz === undefined
      ? "not_detected"
      : averagePitchHz < 145
        ? "low"
        : averagePitchHz > 240
          ? "high"
          : "normal";
  const paceLevel =
    wordsPerMinute === undefined ? "normal" : wordsPerMinute < 105 ? "slow" : wordsPerMinute > 165 ? "fast" : "normal";
  const pausePattern = pauseCount > 5 ? "many_pauses" : pauseCount > 2 ? "some_pauses" : "smooth";

  let toneEstimate: VoiceMetrics["toneEstimate"] = "unknown";

  if (paceLevel === "fast" && (volumeLevel === "loud" || pitchLevel === "high")) {
    toneEstimate = "rushed";
  } else if (pitchLevel === "high" && pausePattern !== "smooth") {
    toneEstimate = "tense";
  } else if (volumeLevel === "soft" && pausePattern !== "smooth") {
    toneEstimate = "uncertain";
  } else if (volumeLevel === "normal" && paceLevel === "normal" && pausePattern === "smooth") {
    toneEstimate = "calm";
  } else if (volumeLevel === "normal" && paceLevel !== "fast") {
    toneEstimate = "confident";
  }

  const confidence =
    durationSeconds >= 5 && wordCount >= 10 && volumes.length > 20 && pitches.length > 5
      ? "high"
      : durationSeconds >= 2 && wordCount >= 4 && volumes.length > 10
        ? "medium"
        : "low";

  return {
    volumeLevel,
    pitchLevel,
    paceLevel,
    pausePattern,
    toneEstimate,
    confidence,
    raw: {
      averageVolume,
      averagePitchHz,
      wordsPerMinute,
      pauseCount,
      durationSeconds,
    },
  };
}

export function useVoiceCapture() {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const transcriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const finalSegmentsRef = useRef<string[]>([]);
  const processedFinalKeysRef = useRef<Set<string>>(new Set());
  const volumesRef = useRef<number[]>([]);
  const pitchesRef = useRef<number[]>([]);
  const pauseCountRef = useRef(0);
  const wasSilentRef = useRef(false);
  const startedAtRef = useRef<number | null>(null);
  const manualStopRef = useRef(false);
  const captureActiveRef = useRef(false);

  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [metrics, setMetrics] = useState<VoiceMetrics | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [stopReason, setStopReason] = useState<VoiceStopReason>(null);
  const [error, setError] = useState<string | null>(null);

  const support = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        speechSupported: false,
        analysisSupported: false,
        supported: false,
        mobile: false,
      };
    }

    const AudioContextConstructor =
      window.AudioContext || (window as WindowWithAudio).webkitAudioContext;
    const speechWindow = window as WindowWithSpeechRecognition;
    const speechSupported = Boolean(
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition,
    );
    const analysisSupported = Boolean(
      AudioContextConstructor && navigator.mediaDevices?.getUserMedia,
    );

    return {
      speechSupported,
      analysisSupported,
      supported: speechSupported || analysisSupported,
      mobile: isLikelyMobileBrowser(),
    };
  }, []);

  const stopAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    void audioContextRef.current?.close();
    audioContextRef.current = null;
  }, []);

  const appendFinalTranscript = useCallback((value: string) => {
    const candidate = value.trim().replace(/\s+/g, " ");
    const normalizedCandidate = normalizeTranscript(candidate);

    if (!normalizedCandidate) {
      return;
    }

    const current = transcriptRef.current.trim();
    const normalizedCurrent = normalizeTranscript(current);
    const lastSegment = finalSegmentsRef.current.at(-1) || "";

    if (
      normalizedCandidate === normalizedCurrent ||
      normalizedCandidate === normalizeTranscript(lastSegment) ||
      (normalizedCurrent && normalizedCurrent.endsWith(` ${normalizedCandidate}`))
    ) {
      return;
    }

    let segmentToAppend = candidate;

    if (normalizedCurrent && normalizedCandidate.startsWith(`${normalizedCurrent} `)) {
      segmentToAppend = candidate.slice(current.length).trim();
    }

    if (!segmentToAppend) {
      return;
    }

    finalSegmentsRef.current.push(segmentToAppend);
    transcriptRef.current = finalSegmentsRef.current.join(" ").trim();
    setTranscript(transcriptRef.current);
  }, []);

  const buildResult = useCallback((): VoiceCaptureResult => {
    if (interimTranscriptRef.current && !transcriptRef.current) {
      appendFinalTranscript(interimTranscriptRef.current);
    }

    const durationSeconds = startedAtRef.current
      ? Math.max(0.1, (Date.now() - startedAtRef.current) / 1000)
      : 0;
    const nextMetrics = classifyMetrics(
      transcriptRef.current,
      volumesRef.current,
      pitchesRef.current,
      pauseCountRef.current,
      durationSeconds,
    );

    setInterimTranscript("");
    interimTranscriptRef.current = "";
    setMetrics(nextMetrics);
    return {
      transcript: transcriptRef.current,
      metrics: nextMetrics,
    };
  }, [appendFinalTranscript]);

  const cleanupRecognition = useCallback((mode: "stop" | "abort") => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;

    if (!recognition) {
      return;
    }

    try {
      if (mode === "abort") {
        recognition.abort();
      } else {
        recognition.stop();
      }
    } catch {
      // Browser speech recognition can throw if it already ended.
    }
  }, []);

  const startCapture = useCallback(async () => {
    manualStopRef.current = true;
    cleanupRecognition("abort");
    stopAudioAnalysis();

    setError(null);
    setMetrics(null);
    setTranscript("");
    setInterimTranscript("");
    setStopReason(null);
    transcriptRef.current = "";
    interimTranscriptRef.current = "";
    finalSegmentsRef.current = [];
    processedFinalKeysRef.current = new Set();
    volumesRef.current = [];
    pitchesRef.current = [];
    pauseCountRef.current = 0;
    wasSilentRef.current = false;
    startedAtRef.current = Date.now();
    captureActiveRef.current = true;
    manualStopRef.current = false;
    setIsAnalyzing(false);

    if (!support.supported) {
      captureActiveRef.current = false;
      setError("Voice input unavailable. Please type instead.");
      return;
    }

    if (!support.speechSupported) {
      setError("Speech recognition is not supported in this browser. Please type instead.");
    } else {
      const speechWindow = window as WindowWithSpeechRecognition;
      const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;

      if (Recognition) {
        const recognition = new Recognition();
        recognition.continuous = !support.mobile;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
          let nextInterimTranscript = "";

          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            const resultText = result[0].transcript.trim();
            const normalizedText = normalizeTranscript(resultText);

            if (!normalizedText) {
              continue;
            }

            if (result.isFinal) {
              const resultKey = `${index}:${normalizedText}`;

              if (!processedFinalKeysRef.current.has(resultKey)) {
                processedFinalKeysRef.current.add(resultKey);
                appendFinalTranscript(resultText);
              }
            } else {
              nextInterimTranscript = `${nextInterimTranscript} ${resultText}`.trim();
            }
          }

          interimTranscriptRef.current = nextInterimTranscript;
          setInterimTranscript(nextInterimTranscript);
        };

        recognition.onerror = (event) => {
          const friendlyErrors: Record<string, string> = {
            "not-allowed": "Microphone permission was blocked. Please type instead.",
            "no-speech": "Recording stopped after silence. Review your transcript before sending.",
            aborted: "Recording stopped. Review your transcript before sending.",
            network: "Speech recognition needs browser speech services. Please type or try again.",
          };

          setError(
            event.error
              ? friendlyErrors[event.error] || `Speech recognition stopped: ${event.error}.`
              : "Speech recognition stopped. Review your transcript before sending.",
          );
          setStopReason(event.error === "not-allowed" ? "error" : "auto");
        };

        recognition.onend = () => {
          const wasManualStop = manualStopRef.current;
          recognitionRef.current = null;

          if (!wasManualStop && captureActiveRef.current) {
            captureActiveRef.current = false;
            stopAudioAnalysis();
            buildResult();
            setIsRecording(false);
            setIsAnalyzing(false);
            setStopReason("auto");
          }

          manualStopRef.current = false;
        };

        recognitionRef.current = recognition;

        try {
          recognition.start();
          setIsRecording(true);
        } catch {
          setError("Speech recognition could not start. Please type instead.");
          recognitionRef.current = null;
        }
      }
    }

    if (!support.analysisSupported) {
      setError((current) =>
        current ||
        "Voice tone analysis is not supported in this browser. You can still type or use basic voice input.",
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextConstructor =
        window.AudioContext || (window as WindowWithAudio).webkitAudioContext;

      if (!AudioContextConstructor) {
        throw new Error("Audio analysis is not supported in this browser.");
      }

      const audioContext = new AudioContextConstructor();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);
      mediaStreamRef.current = stream;
      audioContextRef.current = audioContext;
      setIsRecording(true);
      setIsAnalyzing(true);

      const sample = () => {
        analyser.getFloatTimeDomainData(buffer);

        const rms = Math.sqrt(
          buffer.reduce((sum, value) => sum + value * value, 0) / buffer.length,
        );
        const pitchHz = detectPitchHz(buffer, audioContext.sampleRate);
        const isSilent = rms < 0.012;

        volumesRef.current.push(rms);

        if (pitchHz) {
          pitchesRef.current.push(pitchHz);
        }

        if (isSilent && !wasSilentRef.current) {
          pauseCountRef.current += 1;
        }

        wasSilentRef.current = isSilent;
        animationFrameRef.current = requestAnimationFrame(sample);
      };

      sample();
    } catch (captureError) {
      const friendlyMessage =
        captureError instanceof DOMException && captureError.name === "NotAllowedError"
          ? "Microphone permission was blocked. Please type instead."
          : captureError instanceof Error
            ? captureError.message
            : "Microphone access failed. Please type instead.";

      setError(friendlyMessage);
      setIsRecording(Boolean(recognitionRef.current));
      setIsAnalyzing(false);
    }
  }, [appendFinalTranscript, buildResult, cleanupRecognition, stopAudioAnalysis, support]);

  const stopCapture = useCallback((): VoiceCaptureResult => {
    manualStopRef.current = true;
    captureActiveRef.current = false;
    cleanupRecognition("stop");
    stopAudioAnalysis();
    setIsRecording(false);
    setIsAnalyzing(false);
    setStopReason("manual");
    return buildResult();
  }, [buildResult, cleanupRecognition, stopAudioAnalysis]);

  useEffect(() => {
    return () => {
      manualStopRef.current = true;
      captureActiveRef.current = false;
      cleanupRecognition("abort");
      stopAudioAnalysis();
    };
  }, [cleanupRecognition, stopAudioAnalysis]);

  return {
    startCapture,
    stopCapture,
    transcript,
    interimTranscript,
    metrics,
    isRecording,
    isAnalyzing,
    stopReason,
    error,
    supported: support.supported,
    speechSupported: support.speechSupported,
    analysisSupported: support.analysisSupported,
    mobile: support.mobile,
  };
}
