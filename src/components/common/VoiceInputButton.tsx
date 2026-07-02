"use client";

type VoiceInputButtonProps = {
  supported: boolean;
  listening: boolean;
  onStart: () => void;
  onStop: () => void;
};

export function VoiceInputButton({
  supported,
  listening,
  onStart,
  onStop,
}: VoiceInputButtonProps) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={!supported}
        onClick={listening ? onStop : onStart}
        className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-4 py-3 text-sm font-semibold text-[var(--color-ink)] shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-[var(--color-primary)] hover:text-[var(--color-primary-strong)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:shadow-none"
        title={supported ? "Use Gemini voice input" : "Gemini voice needs microphone recording support"}
      >
        {listening ? "Stop speaking" : "Start speaking"}
      </button>
      {!supported ? (
        <p className="max-w-sm text-xs leading-5 text-[var(--color-ink-soft)]">
          Gemini voice needs microphone permission and MediaRecorder support. You can still type instead.
        </p>
      ) : null}
    </div>
  );
}
