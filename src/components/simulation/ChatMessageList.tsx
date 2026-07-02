import type { SimulationMessage } from "@/types/simulation";

const roleLabels: Record<SimulationMessage["role"], string> = {
  system: "System",
  scenario: "Scenario",
  trainee: "Trainee",
  feedback: "Feedback",
};

const speakerLabels: Record<NonNullable<SimulationMessage["speaker"]>, string> = {
  patient: "Patient",
  family_member: "Family member",
  nurse: "Nurse",
  bystander: "Bystander",
  narrator: "Narrator",
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
        const messageLabel =
          message.role === "scenario" && message.speaker
            ? speakerLabels[message.speaker]
            : roleLabels[message.role];

        return (
          <article
            key={message.id}
            className={`flex ${isTrainee ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[92%] rounded-[1.25rem] px-4 py-3 shadow-[var(--shadow-card)] sm:max-w-3xl ${
                isTrainee
                  ? "rounded-br-md bg-[var(--color-primary)] text-white"
                  : "rounded-bl-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p
                  className={`text-xs font-semibold uppercase tracking-[0.12em] ${
                    isTrainee ? "text-teal-50" : "text-[var(--color-ink-soft)]"
                  }`}
                >
                  {messageLabel}
                </p>
                {canPlay ? (
                  <button
                    type="button"
                    onClick={() =>
                      isSpeaking ? onStopSpeech?.() : onSpeakMessage(message)
                    }
                    className="min-h-8 rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--color-ink-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-strong)]"
                    title={isSpeaking ? "Cancel scenario audio" : "Read scenario audio"}
                  >
                    {isSpeaking ? "Cancel audio" : "Read aloud"}
                  </button>
                ) : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
              {isTrainee && message.voiceMetrics ? (
                <div className="mt-3 rounded-2xl bg-white/15 px-3 py-2 text-xs leading-5 text-teal-50">
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
