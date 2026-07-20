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
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-[var(--shadow-card)] transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60 ${
          isRecording
            ? "border-rose-300 bg-[var(--color-danger-soft)] text-[var(--color-danger)] hover:-translate-y-0.5"
            : "border-[var(--color-border-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:-translate-y-0.5 hover:border-[var(--color-primary)]"
        }`}
      >
        <span
          aria-hidden
          className={`inline-block h-2.5 w-2.5 rounded-full ${
            isRecording
              ? "animate-pulse bg-[var(--color-danger)]"
              : isTranscribing
                ? "animate-pulse bg-amber-500"
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
