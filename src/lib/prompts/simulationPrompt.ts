import type { SimulationState } from "@/types/simulation";

export function buildSimulationPrompt(
  state: SimulationState,
  traineeResponse: string,
): string {
  const recentMessages = state.messages.slice(-4).map((message) => ({
    role: message.role,
    content: message.content,
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

Rules:
- Keep the next scenario message short, realistic, and spoken from the patient/family/situation perspective.
- message: 1 to 3 sentences, under 55 words.
- Increase tension if the trainee is dismissive, vague, rushed, or unclear.
- Reduce tension if the trainee is calm, empathetic, transparent, and clear.
- Ask what the trainee says or does next unless the scenario should end.
- Do not provide diagnosis, medication, treatment instructions, triage advice, or clinical decision-making advice.
- Return only valid JSON:
{
  "message": "string",
  "tensionLevel": "low" | "medium" | "high",
  "shouldEnd": false
}`;
}
