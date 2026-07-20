import { aggregateVoiceMetrics } from "@/lib/audio/voiceMetrics";
import type { SimulationState } from "@/types/simulation";

/**
 * Combine the per-turn delivery metrics into one summary for the prompt, or
 * return null when the trainee only ever typed (or analysis never succeeded).
 */
export function getSimulationVoiceMetrics(state: SimulationState) {
  return aggregateVoiceMetrics(
    state.messages
      .filter((message) => message.role === "trainee" && message.voiceMetrics)
      .map((message) => message.voiceMetrics!),
  );
}

/**
 * Render the captured metrics as prompt text, with null sections dropped so the
 * model is never shown a field it must then be told to ignore.
 */
function formatVoiceMetrics(metrics: NonNullable<ReturnType<typeof getSimulationVoiceMetrics>>) {
  const present = Object.fromEntries(
    Object.entries(metrics).filter(([, value]) => value !== null && value !== undefined),
  );

  return `${JSON.stringify(present)}

How to read these:
- pace.wordsPerMinute is speech rate; roughly 110-150 is comfortable conversational pace.
- pauses counts silences longer than 0.6s between words; "position" is roughly where they clustered.
- pitch.stability and loudness.label describe steadiness of tone and volume, not quality of speech.
- fillers counts words like "um", "uh", "you know" in the transcript.
- confidenceSignal is a SOFT INFERRED CUE derived from pace, pauses, pitch stability and loudness.
  It is NOT a measurement of the trainee's actual confidence, competence, or emotional state.
- Any metric absent from the JSON above was NOT captured for this session.`;
}

/**
 * Delivery coaching runs as its own call, deliberately separate from the scoring
 * call. Keeping the metrics out of the scoring context is what makes
 * "delivery does not affect the score" structurally true rather than merely
 * instructed -- the scoring model cannot be swayed by data it never receives.
 *
 * Returns null when nothing was captured, so no call is made at all.
 */
export function buildDeliveryFeedbackPrompt(state: SimulationState): string | null {
  const metrics = getSimulationVoiceMetrics(state);

  if (!metrics) {
    return null;
  }

  return `You are giving a healthcare communication trainee feedback on HOW they spoke during a
training simulation -- their delivery, not the content of what they said.

Scenario title: ${state.scenario.title}
Trainee objective: ${state.scenario.traineeObjective}

Delivery metrics (measured from the trainee's spoken audio, combined across their spoken turns):
${formatVoiceMetrics(metrics)}

Rules:
- Return 2 to 3 short observations about how the trainee sounded.
- Each item must be one clear sentence under 22 words.
- Reference concrete numbers only where they genuinely help (e.g. "around 165 words per minute").
- Phrase every point as encouragement plus one concrete next step. Never as a verdict on the
  person, and never as praise or criticism of their character, competence, or ability.
- Never comment on a metric that is absent above. Do not guess a value, and do not treat a
  missing metric as a weakness.
- Do not comment on the content, wording, empathy, or clinical handling of the conversation.
  Another reviewer covers that. Stay strictly on delivery.
- Do not assign a score, rating, or grade of any kind.
- Return only valid JSON matching this shape:
{ "deliveryFeedback": ["string"] }`;
}

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

/**
 * Scores and reviews WHAT was said. Deliberately receives no voice metrics --
 * see buildDeliveryFeedbackPrompt.
 */
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
  const metrics = getSimulationVoiceMetrics(state);

  // Trainers write these criteria freely, so some will be about delivery
  // ("kept a calm tone") rather than wording. Hand over the voice metrics when
  // we have them, and be explicit about what is NOT observable either way --
  // otherwise the model invents an assessment to fill the required slot.
  const deliverySection = metrics
    ? `

Delivery metrics (measured from the trainee's spoken audio, for criteria about HOW they spoke):
${formatVoiceMetrics(metrics)}`
    : `

Delivery metrics: none captured. The trainee typed their responses, or voice analysis was
unavailable. You have no information about how they sounded.`;

  return `You are assessing a healthcare communication training conversation against specific
custom evaluation criteria that a trainer added on top of the scenario's default checklist.

Scenario title: ${state.scenario.title}
Conversation log: ${JSON.stringify(conversationLog)}${deliverySection}

Criteria to assess (assess ONLY these, in this exact order):
${extraCriteria.map((criterion, index) => `${index + 1}. ${criterion}`).join("\n")}

Rules:
- Do not deeply judge medical correctness. Focus on communication behavior only.
- Judge each criterion ONLY from evidence actually available above: the conversation log for
  what was said, and the delivery metrics for how it sounded.
- If a criterion asks about something not observable from either source -- for example body
  language, eye contact, facial expression, or tone when no delivery metrics were captured --
  do not guess or infer it from wording. Say plainly that it could not be assessed from this
  session, and briefly why. An honest "not assessable" is always better than a confident guess.
- Return exactly ${extraCriteria.length} entr${extraCriteria.length === 1 ? "y" : "ies"} in customCriteriaFeedback, one per criterion listed above, in the same order.
- Each "criterion" value must exactly match the criterion text given above.
- Each "assessment" must be one clear sentence under 25 words judging how well the trainee met that specific criterion in the conversation.
- Return only valid JSON matching this shape:
{ "customCriteriaFeedback": [{ "criterion": "string", "assessment": "string" }] }`;
}
