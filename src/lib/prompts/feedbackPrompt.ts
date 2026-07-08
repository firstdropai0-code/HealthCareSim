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

Scoring rubric for overallScore (integer 1-10) -- score strictly from what was actually said, do not default to a comfortable middle number:
- 9-10: Consistently empathetic, clear, and professional throughout; the ending condition was met cleanly.
- 7-8: Solid communication overall with only minor gaps (e.g. slightly vague once, one missed acknowledgement).
- 5-6: Adequate but noticeably weak in places -- rushed, vague, or failed to acknowledge emotion at least once.
- 3-4: Frequently dismissive, unclear, sarcastic, curt, or unprofessional; failed to de-escalate a tense moment.
- 1-2: Hostile, mocking, taunting, or refuses to engage constructively; actively worsens the situation.
- Any single clearly hostile, sarcastic, mocking, dismissive, or taunting trainee line (for example: telling a distressed patient or family member to "go ahead" and call a lawyer/media/complaint line in a dismissive or daring tone, or otherwise provoking rather than de-escalating) caps overallScore at 3 for the whole conversation, even if other turns were fine.
- The overallScore value in the JSON shape below is a placeholder for formatting only -- it is not an example of a typical or expected score. Compute it strictly from the rubric above and the actual conversation.

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
  "overallScore": 1,
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
