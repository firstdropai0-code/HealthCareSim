import type { SimulationState } from "@/types/simulation";

function getExtraEvaluationCriteria(state: SimulationState): string[] {
  const defaults = new Set(
    (state.scenario.defaultEvaluationCriteria || []).map((item) => item.trim().toLowerCase()),
  );

  return state.scenario.evaluationCriteria.filter(
    (item) => item.trim() && !defaults.has(item.trim().toLowerCase()),
  );
}

export function buildFeedbackPrompt(state: SimulationState): string {
  const conversationLog = state.messages.map((message) => ({
    role: message.role,
    ...(message.role === "scenario" && message.speaker ? { speaker: message.speaker } : {}),
    content: message.content,
  }));
  const extraCriteria = getExtraEvaluationCriteria(state);

  return `Evaluate this healthcare communication training simulation.

Scenario title: ${state.scenario.title}
Scenario summary: ${state.scenario.summary}
Trainee objective: ${state.scenario.traineeObjective}
Evaluation criteria: ${state.scenario.evaluationCriteria.join(", ")}
Conversation log: ${JSON.stringify(conversationLog)}

Rules:
- Evaluate communication, empathy, clarity, stress handling, and scenario management.
- Do not deeply judge medical correctness.
- Do not provide clinical recommendations, treatment instructions, diagnosis, medication, or triage advice.
- Keep the feedback practical and communication-focused.
- Make the output easy to scan.
- summary: max 35 words.
- Each array should contain 2 to 4 short items.
- Each item should be one clear sentence under 22 words.
- betterResponses should be phrased as direct example lines the trainee could say.
${
  extraCriteria.length > 0
    ? `- The trainer added these extra evaluation criteria beyond the default set: ${extraCriteria.join(", ")}. For customCriteriaFeedback, return exactly one entry per extra criterion listed here (same "criterion" text), each with a one-sentence "assessment" of how well the trainee met it in this conversation.`
    : `- No extra evaluation criteria were added beyond the default set, so return customCriteriaFeedback as an empty array.`
}
- Return only valid JSON matching this shape:
{
  "overallScore": 8,
  "summary": "string",
  "whatWentWell": ["string"],
  "whatCouldImprove": ["string"],
  "communicationGaps": ["string"],
  "betterResponses": ["string"],
  "finalAdvice": "string",
  "customCriteriaFeedback": [{ "criterion": "string", "assessment": "string" }]
}`;
}

