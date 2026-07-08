import type { SimulationState } from "@/types/simulation";

export function getExtraEvaluationCriteria(state: SimulationState): string[] {
  const defaults = new Set(
    (state.scenario.defaultEvaluationCriteria || []).map((item) => item.trim().toLowerCase()),
  );

  return state.scenario.evaluationCriteria.filter(
    (item) => item.trim() && !defaults.has(item.trim().toLowerCase()),
  );
}

function buildConversationLog(state: SimulationState) {
  return state.messages.map((message) => ({
    role: message.role,
    ...(message.role === "scenario" && message.speaker ? { speaker: message.speaker } : {}),
    content: message.content,
  }));
}

export function buildFeedbackPrompt(state: SimulationState): string {
  const conversationLog = buildConversationLog(state);

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
- Return only valid JSON matching this shape:
{
  "overallScore": 8,
  "summary": "string",
  "whatWentWell": ["string"],
  "whatCouldImprove": ["string"],
  "communicationGaps": ["string"],
  "betterResponses": ["string"],
  "finalAdvice": "string"
}`;
}

export function buildCustomCriteriaPrompt(state: SimulationState, extraCriteria: string[]): string {
  const conversationLog = buildConversationLog(state);

  return `You are assessing a healthcare communication training conversation against specific
custom evaluation criteria that a trainer added on top of the scenario's default checklist.

Scenario title: ${state.scenario.title}
Conversation log: ${JSON.stringify(conversationLog)}

Criteria to assess (assess ONLY these, in this exact order):
${extraCriteria.map((criterion, index) => `${index + 1}. ${criterion}`).join("\n")}

Rules:
- Do not deeply judge medical correctness. Focus on communication behavior only.
- Return exactly ${extraCriteria.length} entr${extraCriteria.length === 1 ? "y" : "ies"} in customCriteriaFeedback, one per criterion listed above, in the same order.
- Each "criterion" value must exactly match the criterion text given above.
- Each "assessment" must be one clear sentence under 25 words judging how well the trainee met that specific criterion in the conversation.
- Return only valid JSON matching this shape:
{ "customCriteriaFeedback": [{ "criterion": "string", "assessment": "string" }] }`;
}
