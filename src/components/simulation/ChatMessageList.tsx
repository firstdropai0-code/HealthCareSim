import type { SimulationMessage } from "@/types/simulation";

const roleLabels: Record<SimulationMessage["role"], string> = {
  system: "System",
  scenario: "Scenario",
  trainee: "Trainee",
  feedback: "Feedback",
};

export function ChatMessageList({ messages }: { messages: SimulationMessage[] }) {
  return (
    <div className="space-y-4">
      {messages.map((message) => {
        const isTrainee = message.role === "trainee";

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
              <p
                className={`text-xs font-semibold uppercase ${
                  isTrainee ? "text-emerald-100" : "text-slate-500"
                }`}
              >
                {roleLabels[message.role]}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
