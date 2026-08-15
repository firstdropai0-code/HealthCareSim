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

/**
 * The transcript, with every scenario-side message numbered. That number is
 * what betterResponses points back at, so each suggested line is anchored to the
 * moment it answers instead of floating free of the conversation. Trainee turns
 * are deliberately left unnumbered: the trainee always replies to a scenario
 * message, so one sequence is enough and two would invite the model to mix them.
 */
function buildConversationLog(state: SimulationState) {
  let scenarioTurn = 0;

  return state.messages.map((message) => {
    if (message.role !== "scenario") {
      return { role: message.role, content: message.content };
    }

    scenarioTurn += 1;

    return {
      role: message.role,
      turn: scenarioTurn,
      ...(message.speaker ? { speaker: message.speaker } : {}),
      content: message.content,
    };
  });
}

/**
 * The trainer's custom criteria are assessed in the SAME call as the main
 * report (not a separate one), so both sections come from a single reasoning
 * pass over the transcript. This block is appended to the main prompt when
 * extra criteria exist; the model is told explicitly to keep the criteria
 * assessments consistent with the report it just wrote rather than re-deriving
 * an independent -- and possibly contradictory -- judgement of the same
 * behavior. Delivery metrics are handed over here too (when captured) for
 * criteria about HOW the trainee spoke.
 */
function buildCustomCriteriaSection(state: SimulationState, extraCriteria: string[]): string {
  const metrics = getSimulationVoiceMetrics(state);

  const deliverySection = metrics
    ? `Delivery metrics for criteria about HOW the trainee spoke (measured from their audio):
${formatVoiceMetrics(metrics)}`
    : `Delivery metrics: none captured. The trainee typed their responses, or voice analysis was
unavailable, so you have NO verifiable information about how they sounded, including pauses,
silence, or pace.`;

  return `
The trainer added these custom evaluation criteria on top of the defaults. Assess ONLY these,
in this exact order, and return one entry per criterion in customCriteriaFeedback:
${extraCriteria.map((criterion, index) => `${index + 1}. ${criterion}`).join("\n")}

${deliverySection}

Rules for customCriteriaFeedback:
- STAY CONSISTENT WITH THE REPORT ABOVE. These criteria overlap with behavior you already
  judged in whatWentWell, whatCouldImprove, and communicationGaps. When a criterion is about a
  behavior you already assessed, the assessment MUST reach the SAME verdict you gave above --
  never the opposite. Do not re-judge the same behavior from scratch or contradict a point you
  already made in this report.
- Judge each criterion ONLY from evidence actually available: the conversation log for what was
  said, and the delivery metrics above for how it sounded.
- If a criterion asks about something you CANNOT verify from those two sources, you MUST NOT
  guess a verdict. This includes silence, pause length, or pace when no delivery metrics were
  captured, and body language, eye contact, facial expression, or tone from text alone. In that
  case the assessment must plainly state it could not be assessed from this session and why --
  unless the report above already reached a conclusion about that same behavior, in which case
  agree with the report. Inventing a confident verdict to fill the slot is not allowed; "could
  not be assessed from this session" is the required answer whenever the evidence is not there.
- Each "criterion" value must exactly match the criterion text given above, in the same order.
- Each "assessment" must be one clear sentence under 25 words.
`;
}

/**
 * Scores and reviews WHAT was said, and -- when the trainer added custom
 * criteria -- assesses those in the same response. Deliberately receives no
 * voice metrics for scoring (see buildDeliveryFeedbackPrompt); the custom
 * criteria section separately receives delivery metrics only for criteria about
 * how the trainee spoke.
 */
export function buildFeedbackPrompt(state: SimulationState, extraCriteria: string[] = []): string {
  const conversationLog = buildConversationLog(state);
  const hasCustomCriteria = extraCriteria.length > 0;
  const customCriteriaSection = hasCustomCriteria
    ? buildCustomCriteriaSection(state, extraCriteria)
    : "";
  const customCriteriaField = hasCustomCriteria
    ? `,
  "customCriteriaFeedback": [{ "criterion": "string", "assessment": "string" }]`
    : "";

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

Scoring rubric for subscores (each an integer 1-10, scored on the same 1-10 scale as overallScore):
- empathy: acknowledging emotion before explaining facts; naming what the other person is feeling rather than moving straight to information.
- clarity: plain, jargon-free language; one idea at a time; no information overload.
- structure: managing the conversation -- checking understanding, setting expectations, and naming a concrete next step.
- professionalism: respectful, non-defensive, never curt, sarcastic, or blaming.
- deEscalation: steadying the situation when the other person is angry, frightened, or pressing; not matching their heat.
- Score each dimension independently from what was actually said. A trainee can be warm but unclear, or clear but cold.
- The subscores must be consistent with overallScore: do not report a set of high subscores alongside a low overall, or the reverse. overallScore is a judgement of the whole conversation, NOT the average of the subscores.
- If the hostility cap above applied, deEscalation and professionalism must also be 3 or lower.
- The subscore values in the JSON shape below are placeholders for formatting only, not expected scores.

Rules:
- Evaluate communication, empathy, clarity, stress handling, and scenario management.
- Do not deeply judge medical correctness.
- Do not provide clinical recommendations, treatment instructions, diagnosis, medication, or triage advice.
- Keep the feedback practical and communication-focused.
- Make the output easy to scan.
- summary: max 35 words.
- Each array should contain 2 to 4 short items.
- Each item should be one clear sentence under 22 words.

Rules for betterResponses -- each one is a rewrite of a specific moment, not general advice:
- "suggestion" is the exact line the trainee could have said, in their own voice, ready to speak.
- "respondsToTurn" is the "turn" number of the scenario message in the log above that this line
  answers. Use only numbers that appear as a "turn" value in the log; never invent one, and never
  count trainee messages.
- "inResponseTo" is a short quote of up to 12 words, copied from that same scenario message, so it
  is clear which moment you mean.
- Prefer the moments the trainee actually handled worst. Do not give two suggestions for the same
  turn unless the conversation genuinely had nothing else worth improving.
${customCriteriaSection}- Return only valid JSON matching this shape:
{
  "overallScore": 1,
  "subscores": { "empathy": 1, "clarity": 1, "structure": 1, "professionalism": 1, "deEscalation": 1 },
  "summary": "string",
  "whatWentWell": ["string"],
  "whatCouldImprove": ["string"],
  "communicationGaps": ["string"],
  "betterResponses": [{ "respondsToTurn": 1, "inResponseTo": "string", "suggestion": "string" }],
  "finalAdvice": "string"${customCriteriaField}
}`;
}
