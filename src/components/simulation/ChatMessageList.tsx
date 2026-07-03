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

type ChatMessageListProps = {
  messages: SimulationMessage[];
};

export function ChatMessageList({ messages }: ChatMessageListProps) {
  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isTrainee = message.role === "trainee";
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
              <p
                className={`text-xs font-semibold uppercase tracking-[0.12em] ${
                  isTrainee ? "text-teal-50" : "text-[var(--color-ink-soft)]"
                }`}
              >
                {messageLabel}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
