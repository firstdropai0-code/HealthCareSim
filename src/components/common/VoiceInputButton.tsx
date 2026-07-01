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
        className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-emerald-600 hover:text-emerald-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
        title={supported ? "Use Gemini voice input" : "Gemini voice needs microphone recording support"}
      >
        {listening ? "Stop speaking" : "Start speaking"}
      </button>
      {!supported ? (
        <p className="max-w-sm text-xs leading-5 text-slate-500">
          Gemini voice needs microphone permission and MediaRecorder support. You can still type instead.
        </p>
      ) : null}
    </div>
  );
}
