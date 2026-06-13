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
        title={supported ? "Use voice input" : "Speech recognition is not supported"}
      >
        {listening ? "Stop voice" : "Use voice"}
      </button>
      {!supported ? (
        <p className="max-w-sm text-xs leading-5 text-slate-500">
          Voice input requires Chrome or Edge with microphone permission. This browser does not expose the Web Speech API.
        </p>
      ) : null}
    </div>
  );
}
