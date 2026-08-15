import type { ScenarioDifficulty } from "@/lib/scenarios/scenarioLibrary";

/**
 * The tier is an INPUT constraint only. It shapes how demanding the generated
 * roleplay is, so the label a mentor picks and the case they get agree with
 * each other. It is deliberately never part of the response schema — the stored
 * value stays the mentor's, so the model cannot invent a tier and quietly
 * reclassify where a run counts on the skill tree.
 *
 * The wording tracks `difficultyMeta` in scenarioLibrary.ts, so the tier a
 * mentor reads on the chip is the tier the generator is working to. Difficulty
 * here means EMOTIONAL and COMMUNICATIVE demand, never clinical complexity —
 * the safety rules below still hold at every tier.
 */
const difficultyGuidance: Record<ScenarioDifficulty, string> = {
  foundational: `Difficulty: FOUNDATIONAL - a clear task with a cooperative counterpart.
- The patient or family member is worried or frustrated but reasonable, and responds well to being heard.
- One concern at a time. No hostility, no accusation, no bereavement.
- The trainee's objective is unambiguous and achievable within the turns available.`,

  intermediate: `Difficulty: INTERMEDIATE - conflict, blame, or an anxious family to steady.
- The counterpart pushes back: they are angry, distrustful, blaming, or too distressed to take information in first time.
- Include one genuine complication - a missed expectation, a broken promise, or a second person with a competing need.
- Acknowledgement alone is not enough; the trainee has to hold a boundary or manage a disagreement as well.
- endingCondition: a real resolution IS reachable here - the counterpart can end up reassured, or agreeing a next step.`,

  advanced: `Difficulty: ADVANCED - death, safeguarding, or hostility under pressure.
- The stakes are grave AND largely outside the trainee's control: a death or a life that may not be saved, permanent harm, a safeguarding concern, or a formal complaint or threat.
- Vary this across scenarios. Not every advanced case should be a death - "may not survive", "will not recover the function they had", "this will be investigated", and "the child cannot go home today" are all grave without being a bereavement.
- The counterpart may be hostile, may be inconsolable, or may want a commitment the trainee cannot honestly give. They do not fully calm down.
- CRITICAL - endingCondition: there is no clean resolution available, so the ending must NOT be agreement, calm, acceptance, satisfaction, or restored trust. It marks the point where the trainee has done everything that could honestly be done, with the situation still unresolved. A soft, tidy ending makes this tier indistinguishable from intermediate.
- Write that ending in the concrete terms of THIS case - name the specific thing that had to be said or held to, and the specific way this person is left. Do not fall back on a stock formula such as "remains distressed and may not accept it"; two advanced scenarios should not end with the same sentence shape.
- Keep the difficulty emotional and relational. Do NOT make it hard by adding clinical or technical complexity.`,
};

export function buildScenarioPrompt(
  input: string,
  difficulty: ScenarioDifficulty = "intermediate",
): string {
  return `Convert this rough trainer idea into a structured healthcare communication training scenario.

Trainer idea:
${input}

${difficultyGuidance[difficulty]}

Rules:
- Write the scenario at the difficulty stated above. If the trainer's idea sounds gentler or harsher than that tier, keep their situation and people but pitch the counterpart's behaviour and the pressure to the stated tier.
- Focus on communication, empathy, patient interaction, and pressure handling.
- Do not provide diagnosis, medication, treatment instructions, triage advice, or clinical decision-making advice.
- Keep clinical details generic and only as context for communication.
- Keep every string short and skimmable. Prefer one sentence per field.
- summary: max 30 words.
- patientProfile: max 22 words.
- startingSituation: max 35 words.
- firstPrompt is the OPENING LINE of the simulation, spoken ONLY from the patient / family member / narrator perspective - the situation the trainee (who is the doctor) must respond to. It must NEVER be the doctor's or trainee's dialogue. Write it as the narrator setting the scene and/or the patient's own words, ending by prompting the trainee to respond. Max 35 words.
- CRITICAL: the doctor/clinician is the TRAINEE. Never write the firstPrompt as the clinician greeting, questioning, reassuring, or introducing themselves to the patient. It must not contain the clinician speaking in the first person ("I'm here to...", "the nurse told me...", "how are you feeling?", "let me explain..."). Any first-person "I" in the firstPrompt must belong to the patient or family member, never the doctor.
- Bad firstPrompt (this is the DOCTOR speaking - never do this):
  "Mr. Harrison, it's completely normal to have questions. How are you feeling?"
- Bad firstPrompt (also the DOCTOR speaking - never do this):
  "Mr. Harrison, the nurse just told me you're waiting for an update on your child. I'm here to speak with you. What do you say?"
- Good firstPrompt (narrator sets the scene and prompts the trainee):
  "Mr. Harrison sits with his arms crossed, avoiding eye contact and giving short answers. He asks nothing. What do you say to him?"
- Good firstPrompt (narrator scene + patient's own words):
  "Mrs. Alvarez looks up as you enter, still calm. 'Is there any news on my daughter yet?' she asks. What do you say?"
- familyEmotion is REQUIRED. It describes the emotional state of the family member or bystander the trainee actually speaks to, and it must describe THEM, not the patient. Whenever the starting situation or firstPrompt involves a parent, relative, partner, or bystander - which is most scenarios, and always the case when the patient is unconscious, sedated, or too young to speak for themselves - fill it in with their state. Only write "No family or bystander present" when the trainee genuinely deals with the patient alone.
- patientEmotion describes the patient. If the patient cannot speak (unconscious, sedated, an infant), say so plainly there; do not put the family's emotion in that field.
- evaluationCriteria: exactly 4 short items.
- suggestedTurns: 3 to 5.
- Return only valid JSON matching this TypeScript shape:
{
  "id": "string",
  "title": "string",
  "setting": "string",
  "summary": "string",
  "patientProfile": "string",
  "patientEmotion": "string",
  "familyEmotion": "string",
  "traineeObjective": "string",
  "communicationChallenge": "string",
  "startingSituation": "string",
  "firstPrompt": "string",
  "suggestedTurns": 5,
  "endingCondition": "string",
  "evaluationCriteria": ["string"],
  "mediaAssets": []
}`;
}
