"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  onstart: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionAlternative = {
  readonly transcript: string;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function useSpeechToText(options?: { onTranscript?: (text: string) => void }) {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onTranscriptRef = useRef(options?.onTranscript);
  const finalTranscriptRef = useRef("");
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }, []);

  useEffect(() => {
    onTranscriptRef.current = options?.onTranscript;
  }, [options?.onTranscript]);

  useEffect(() => {
    if (!supported || typeof window === "undefined") {
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognition) {
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let finalText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) {
          finalText += event.results[index][0].transcript;
        }
      }

      const normalizedFinalText = finalText.trim();

      if (!normalizedFinalText) {
        return;
      }

      finalTranscriptRef.current = `${finalTranscriptRef.current} ${normalizedFinalText}`.trim();
      setTranscript(finalTranscriptRef.current);
      onTranscriptRef.current?.(normalizedFinalText);
    };

    recognition.onerror = (event) => {
      const errorMessages: Record<string, string> = {
        "not-allowed": "Microphone permission was blocked. Allow microphone access and try again.",
        "no-speech": "No speech was detected. Try again in a quieter place.",
        network: "Speech recognition needs browser speech services. Check your connection and try again.",
      };

      setError(
        event.error
          ? errorMessages[event.error] || `Speech recognition failed: ${event.error}.`
          : "Speech recognition failed.",
      );
      setListening(false);
    };

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
      recognitionRef.current = null;
    };
  }, [supported]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    setError(null);
    setTranscript("");
    finalTranscriptRef.current = "";

    try {
      recognitionRef.current.start();
    } catch {
      setError("Speech recognition could not start. Stop and try again.");
      setListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return {
    transcript,
    listening,
    supported,
    error,
    startListening,
    stopListening,
    setTranscript,
  };
}
