import type { FeedbackReport } from "@/types/feedback";
import type { SimulationState } from "@/types/simulation";

function formatList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

export function buildFeedbackExportText(
  state: SimulationState,
  report: FeedbackReport,
): string {
  const transcript = state.messages
    .map((message) => {
      const role = message.role.toUpperCase();
      return `[${role}] ${message.content}`;
    })
    .join("\n\n");

  return `FirstDrop Feedback Report

Scenario: ${state.scenario.title}
Generated: ${new Date().toLocaleString()}

Conversation Transcript
${transcript}

Overall Score
${report.overallScore}/10

Summary
${report.summary}

What Went Well
${formatList(report.whatWentWell)}

What Could Improve
${formatList(report.whatCouldImprove)}

Communication Gaps
${formatList(report.communicationGaps)}

Better Response Examples
${formatList(report.betterResponses)}

Final Advice
${report.finalAdvice}
`;
}

export function exportFeedback(state: SimulationState, report: FeedbackReport): void {
  const text = buildFeedbackExportText(state, report);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${state.scenario.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-feedback.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}
