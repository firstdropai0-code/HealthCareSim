import type { SimulationState } from "@/types/simulation";
import type { VoiceMetrics } from "@/types/voice";

function summarizeVoiceMetrics(metrics?: VoiceMetrics): string {
  if (!metrics) {
    return "None provided.";
  }

  return JSON.stringify({
    volume: metrics.volumeLevel,
    pitch: metrics.pitchLevel,
    pace: metrics.paceLevel,
    pauses: metrics.pausePattern,
    toneEstimate: metrics.toneEstimate,
    confidence: metrics.confidence,
  });
}

export function buildSimulationPrompt(
  state: SimulationState,
  traineeResponse: string,
  voiceMetrics?: VoiceMetrics,
): string {
  const recentMessages = state.messages.slice(-4).map((message) => ({
    role: message.role,
    content: message.content,
    ...(message.role === "trainee" && message.voiceMetrics
      ? { voiceDeliveryEstimate: summarizeVoiceMetrics(message.voiceMetrics) }
      : {}),
  }));

  return `Continue this healthcare communication roleplay scenario.

Scenario summary: ${state.scenario.summary}
Patient profile: ${state.scenario.patientProfile}
Communication challenge: ${state.scenario.communicationChallenge}
Current turn: ${state.currentTurn}
Remaining turns: ${Math.max(state.maxTurns - state.currentTurn, 0)}
Current tension level: ${state.tensionLevel}
Recent messages: ${JSON.stringify(recentMessages)}
Latest trainee response: ${traineeResponse}
Latest voice delivery estimate: ${summarizeVoiceMetrics(voiceMetrics)}

Rules:
- Keep the next scenario message short, realistic, and spoken from the patient/family/situation perspective.
- message: 1 to 3 sentences, under 55 words.
- Consider both what the trainee said and the estimated delivery pattern.
- Treat voice delivery as a light communication cue, never as the main reason for the next turn.
- Do not change tension based on one voice metric alone.
- Increase tension only if the trainee is dismissive, vague, unclear, or if several medium/high-confidence delivery cues suggest rushed, loud, tense, or frustrated communication.
- Reduce tension if the trainee is calm, empathetic, transparent, clear, and delivery appears steady.
- Voice estimates are approximate; low-confidence metrics are weak signals and may be ignored.
- Ask what the trainee says or does next unless the scenario should end.
- Do not provide diagnosis, medication, treatment instructions, triage advice, or clinical decision-making advice.
- Return only valid JSON:
{
  "message": "string",
  "tensionLevel": "low" | "medium" | "high",
  "shouldEnd": false
}`;
}
