import type { SimulationMessage } from "@/types/simulation";

const roleLabels: Record<SimulationMessage["role"], string> = {
  system: "System",
  scenario: "Scenario",
  trainee: "Trainee",
  feedback: "Feedback",
};

function labelValue(value: string): string {
  return value.replace(/_/g, " ");
}

type ChatMessageListProps = {
  messages: SimulationMessage[];
  speechSupported?: boolean;
  speakingMessageId?: string | null;
  onSpeakMessage?: (message: SimulationMessage) => void;
  onStopSpeech?: () => void;
};

export function ChatMessageList({
  messages,
  speechSupported = false,
  speakingMessageId,
  onSpeakMessage,
  onStopSpeech,
}: ChatMessageListProps) {
  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isTrainee = message.role === "trainee";
        const canPlay = message.role === "scenario" && speechSupported && onSpeakMessage;
        const isSpeaking = speakingMessageId === message.id;

        return (
          <article
            key={message.id}
            className={`flex ${isTrainee ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-3xl rounded-lg px-4 py-3 shadow-sm ${
                isTrainee
                  ? "bg-emerald-800 text-white"
                  : "border border-slate-200 bg-white text-slate-800"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p
                  className={`text-xs font-semibold uppercase ${
                    isTrainee ? "text-emerald-100" : "text-slate-500"
                  }`}
                >
                  {roleLabels[message.role]}
                </p>
                {canPlay ? (
                  <button
                    type="button"
                    onClick={() =>
                      isSpeaking ? onStopSpeech?.() : onSpeakMessage(message)
                    }
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-emerald-500 hover:text-emerald-800"
                    title={isSpeaking ? "Stop scenario audio" : "Play scenario audio"}
                  >
                    {isSpeaking ? "Stop audio" : "Play audio"}
                  </button>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
              {isTrainee && message.voiceMetrics ? (
                <div className="mt-3 rounded-md bg-white/15 px-3 py-2 text-xs leading-5 text-emerald-50">
                  <span className="font-semibold">Estimated voice delivery:</span>{" "}
                  possibly {labelValue(message.voiceMetrics.toneEstimate)} /{" "}
                  {message.voiceMetrics.confidence === "low"
                    ? "low confidence estimate"
                    : `${message.voiceMetrics.confidence} confidence`}
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
