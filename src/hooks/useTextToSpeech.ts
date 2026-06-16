"use client";

import { useCallback, useMemo, useRef, useState } from "react";

type SpeakOptions = {
  rate?: number;
  pitch?: number;
  volume?: number;
};

export function useTextToSpeech() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supported = useMemo(() => {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }, []);

  const stop = useCallback(() => {
    if (!supported) {
      return;
    }

    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeaking(false);
    setPaused(false);
  }, [supported]);

  const speak = useCallback(
    (text: string, options?: SpeakOptions) => {
      if (!supported) {
        setError("Text-to-speech is not supported in this browser.");
        return;
      }

      const trimmedText = text.trim();

      if (!trimmedText) {
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(trimmedText);
      utterance.rate = options?.rate ?? 1;
      utterance.pitch = options?.pitch ?? 1;
      utterance.volume = options?.volume ?? 1;

      utterance.onstart = () => {
        setError(null);
        setSpeaking(true);
        setPaused(false);
      };

      utterance.onpause = () => {
        setPaused(true);
      };

      utterance.onresume = () => {
        setPaused(false);
      };

      utterance.onend = () => {
        setSpeaking(false);
        setPaused(false);
        utteranceRef.current = null;
      };

      utterance.onerror = () => {
        setError("Text-to-speech playback failed.");
        setSpeaking(false);
        setPaused(false);
        utteranceRef.current = null;
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [supported],
  );

  const pause = useCallback(() => {
    if (!supported || !speaking) {
      return;
    }

    window.speechSynthesis.pause();
    setPaused(true);
  }, [speaking, supported]);

  const resume = useCallback(() => {
    if (!supported || !paused) {
      return;
    }

    window.speechSynthesis.resume();
    setPaused(false);
  }, [paused, supported]);

  return {
    speak,
    stop,
    pause,
    resume,
    speaking,
    paused,
    supported,
    error,
  };
}
