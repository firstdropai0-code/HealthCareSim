"use client";

import { useVoiceRecorder } from "@/lib/hooks/useVoiceRecorder";
import type { VoiceMetrics } from "@/types/voice";

type MicButtonProps = {
  /**
   * Called with the transcript once a recording is stopped and transcribed.
   * voiceMetrics is null when delivery analysis was unavailable.
   */
  onTranscript: (text: string, voiceMetrics: VoiceMetrics | null) => void;
  /** Disable the control (e.g. while a request is in flight). */
  disabled?: boolean;
  className?: string;
};

/**
 * Small mic toggle: press to record, press again to stop and transcribe. The
 * transcript is handed back to the parent via onTranscript. Degrades to a
 * disabled state (never a crash) when the browser or key is unavailable.
 */
export function MicButton({ onTranscript, disabled = false, className = "" }: MicButtonProps) {
  const { status, error, isSupported, start, stop } = useVoiceRecorder();

  const isRecording = status === "recording";
  const isTranscribing = status === "transcribing";
  const controlDisabled = disabled || isTranscribing || !isSupported;

  async function handleClick() {
    if (isRecording) {
      const { text, voiceMetrics } = await stop();
      if (text) {
        onTranscript(text, voiceMetrics);
      }
      return;
    }

    await start();
  }

  const label = !isSupported
    ? "Voice input unavailable"
    : isTranscribing
      ? "Transcribing..."
      : isRecording
        ? "Stop recording"
        : "Record voice input";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={controlDisabled}
        aria-pressed={isRecording}
        title={label}
        className={`eyebrow eyebrow-tight inline-flex min-h-11 items-center gap-2 border px-4 py-2 transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${
          isRecording
            ? "border-[var(--color-danger)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
            : "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-ink)]"
        }`}
      >
        <span
          aria-hidden
          className={`inline-block h-1.5 w-1.5 ${
            isRecording
              ? "animate-pulse bg-[var(--color-danger)]"
              : isTranscribing
                ? "animate-pulse bg-[var(--color-warning)]"
                : "bg-[var(--color-primary)]"
          }`}
        />
        {isTranscribing ? "Transcribing..." : isRecording ? "Stop" : "Speak"}
      </button>
      {error ? (
        <span className="text-xs font-medium text-[var(--color-danger)]">{error}</span>
      ) : !isSupported ? (
        <span className="text-xs font-medium text-[var(--color-ink-soft)]">
          Voice input unavailable in this browser.
        </span>
      ) : null}
    </div>
  );
}
