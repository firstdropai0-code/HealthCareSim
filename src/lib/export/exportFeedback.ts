import type { FeedbackReport } from "@/types/feedback";
import type { SimulationState } from "@/types/simulation";
import type { VoiceMetrics } from "@/types/voice";

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

function formatVoiceMetrics(metrics?: VoiceMetrics): string {
  if (!metrics) {
    return "";
  }

  const confidenceText =
    metrics.confidence === "low"
      ? "low confidence estimate"
      : `${metrics.confidence} confidence`;

  return [
    `Estimated voice delivery pattern: possibly ${formatLabel(metrics.toneEstimate)} (${confidenceText})`,
    `Volume: ${formatLabel(metrics.volumeLevel)}`,
    `Pitch: ${formatLabel(metrics.pitchLevel)}`,
    `Pace: ${formatLabel(metrics.paceLevel)}`,
    `Clarity: ${formatLabel(metrics.clarityLevel || "unknown")}`,
    `Pauses: ${formatLabel(metrics.pausePattern)}`,
    "Audio is uploaded only for immediate transcription and is not stored by this prototype.",
  ].join("\n");
}

export function buildFeedbackExportText(
  state: SimulationState,
  report: FeedbackReport,
): string {
  const transcript = state.messages
    .map((message) => {
      const role = formatRoleLabel(message);
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
Based on estimated voice delivery patterns, not medical or personal judgement.
${report.voiceDeliveryFeedback.summary}

Voice Delivery Strengths
${formatList(report.voiceDeliveryFeedback.strengths)}

Voice Delivery Improvements
${formatList(report.voiceDeliveryFeedback.improvements)}
`
    : "";

  return `FirstDropAI Feedback Report

Scenario: ${state.scenario.title}
Generated: ${new Date().toLocaleString()}${report.source === "fallback" ? `\nFeedback source: ${report.fallbackReason || "Basic fallback feedback generated because Gemini feedback was unavailable."}` : ""}

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
