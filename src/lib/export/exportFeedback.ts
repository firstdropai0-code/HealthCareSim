import type { FeedbackReport } from "@/types/feedback";
import type { SimulationState } from "@/types/simulation";
import type { VoiceMetrics } from "@/types/voice";

function formatList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function formatVoiceMetrics(metrics?: VoiceMetrics): string {
  if (!metrics) {
    return "";
  }

  return [
    `Voice delivery estimate: ${metrics.toneEstimate} (${metrics.confidence} confidence)`,
    `Volume: ${metrics.volumeLevel}`,
    `Pitch: ${metrics.pitchLevel}`,
    `Pace: ${metrics.paceLevel}`,
    `Pauses: ${metrics.pausePattern}`,
  ].join("\n");
}

export function buildFeedbackExportText(
  state: SimulationState,
  report: FeedbackReport,
): string {
  const transcript = state.messages
    .map((message) => {
      const role = message.role.toUpperCase();
      const voiceMetrics =
        message.role === "trainee" ? formatVoiceMetrics(message.voiceMetrics) : "";

      return voiceMetrics
        ? `[${role}] ${message.content}\n${voiceMetrics}`
        : `[${role}] ${message.content}`;
    })
    .join("\n\n");
  const voiceDelivery = report.voiceDeliveryFeedback
    ? `
Voice Delivery Feedback
${report.voiceDeliveryFeedback.summary}

Voice Delivery Strengths
${formatList(report.voiceDeliveryFeedback.strengths)}

Voice Delivery Improvements
${formatList(report.voiceDeliveryFeedback.improvements)}
`
    : "";

  return `FirstDropAI Feedback Report

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
${voiceDelivery}

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
