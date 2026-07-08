import type { FeedbackReport } from "@/types/feedback";
import type { SimulationState } from "@/types/simulation";

function formatList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function formatLabel(value: string): string {
  return value.replace(/_/g, " ");
}

function formatRoleLabel(message: SimulationState["messages"][number]): string {
  if (message.role === "scenario" && message.speaker) {
    return formatLabel(message.speaker).toUpperCase();
  }

  return message.role.toUpperCase();
}

export function buildFeedbackExportText(
  state: SimulationState,
  report: FeedbackReport,
): string {
  const conversationLog = state.messages
    .map((message) => `[${formatRoleLabel(message)}] ${message.content}`)
    .join("\n\n");

  return `FirstDropAI Feedback Report

Scenario: ${state.scenario.title}
Generated: ${new Date().toLocaleString()}${report.source === "fallback" ? `\nFeedback source: ${report.fallbackReason || "Basic fallback feedback generated because Gemini feedback was unavailable."}` : ""}

Conversation Log
${conversationLog}

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
${
  report.customCriteriaFeedback && report.customCriteriaFeedback.length > 0
    ? `\nYour Added Evaluation Criteria\n${report.customCriteriaFeedback
        .map((item) => `- ${item.criterion}: ${item.assessment}`)
        .join("\n")}\n`
    : ""
}
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

